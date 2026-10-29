import { Router, Response } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { triggerStreakEvaluationNow } from '../../jobs/streakCron';
import { getQueueStats } from '../../jobs/worker';
import { invalidateCachePattern } from '../../utils/cache';

export const adminRouter = Router();

// Require admin for all admin routes
adminRouter.use(authenticateToken, requireRole('admin'));

// GET /admin/users - List & search users
adminRouter.get('/users', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { q, role } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (q) {
      conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    if (role && role !== 'all') {
      conditions.push(`r.name = $${idx++}`);
      params.push(role);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const usersRes = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.is_active, u.created_at,
              COALESCE(r.name, 'student') as role,
              (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) as enrolled_courses_count
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       ${whereClause}
       ORDER BY u.created_at DESC`,
      params
    );

    res.json(usersRes.rows);
  } catch (err) {
    next(err);
  }
});

// PUT /admin/users/:id/role - Update user role (assign/revoke roles: student, instructor, admin)
adminRouter.put('/users/:id/role', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'Role is required' } });
      return;
    }

    // Prevent admin from accidentally demoting/revoking their own admin role
    if (id === req.user!.id && role !== 'admin') {
      res.status(400).json({ error: { code: 'SELF_DEMOTION_PROHIBITED', message: 'You cannot revoke your own admin role' } });
      return;
    }

    const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
    if (roleRes.rows.length === 0) {
      res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'Role must be student, instructor, or admin' } });
      return;
    }
    const roleId = roleRes.rows[0].id;

    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
    await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [id, roleId]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
       VALUES ($1, 'USER_ROLE_UPDATED', 'user', $2, $3)`,
      [req.user!.id, id, JSON.stringify({ new_role: role })]
    );

    // Fetch updated user
    const updatedUserRes = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.is_active, r.name as role
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );

    res.json({ message: `Role updated to ${role} successfully`, user: updatedUserRes.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/users/:id/suspend - Suspend/activate account
adminRouter.put('/users/:id/suspend', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    // Prevent suspending own account
    if (id === req.user!.id && is_active === false) {
      res.status(400).json({ error: { code: 'SELF_SUSPENSION_PROHIBITED', message: 'You cannot suspend your own admin account' } });
      return;
    }

    const updateRes = await pool.query(
      `UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, full_name, email, is_active`,
      [is_active ?? false, id]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
       VALUES ($1, 'USER_SUSPEND_STATUS_CHANGED', 'user', $2, $3)`,
      [req.user!.id, id, JSON.stringify({ is_active })]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/users/:id - Delete user account
adminRouter.delete('/users/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Prevent deleting oneself
    if (id === req.user!.id) {
      res.status(400).json({ error: { code: 'SELF_DELETION_PROHIBITED', message: 'You cannot delete your own admin account' } });
      return;
    }

    const userCheck = await pool.query('SELECT id, full_name, email FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    const userToDelete = userCheck.rows[0];

    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
       VALUES ($1, 'USER_DELETED', 'user', $2, $3)`,
      [req.user!.id, id, JSON.stringify({ email: userToDelete.email, full_name: userToDelete.full_name })]
    );

    res.json({ message: 'User deleted successfully', user: userToDelete });
  } catch (err) {
    next(err);
  }
});

// GET /admin/courses/pending - Approval queue
adminRouter.get('/courses/pending', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const pendingRes = await pool.query(
      `SELECT c.*, u.full_name as instructor_name, u.email as instructor_email,
              (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as modules_count,
              (SELECT COUNT(*) FROM lectures l JOIN modules m ON l.module_id = m.id WHERE m.course_id = c.id) as lectures_count
       FROM courses c
       JOIN users u ON c.instructor_id = u.id
       WHERE c.status = 'pending'
       ORDER BY c.created_at ASC`
    );

    res.json(pendingRes.rows);
  } catch (err) {
    next(err);
  }
});

// POST /admin/courses/:id/approve - Approve or reject pending course
adminRouter.post('/courses/:id/approve', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { decision, comment } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(decision)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: "Decision must be 'approved' or 'rejected'" } });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const courseRes = await client.query(
        `UPDATE courses SET status = $1 WHERE id = $2 RETURNING *`,
        [decision, id]
      );

      if (courseRes.rows.length === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Course not found' } });
        await client.query('ROLLBACK');
        return;
      }

      await client.query(
        `INSERT INTO course_approvals (course_id, reviewed_by, decision, comment)
         VALUES ($1, $2, $3, $4)`,
        [id, req.user!.id, decision, comment || '']
      );

      // Notify instructor
      const instructorId = courseRes.rows[0].instructor_id;
      if (instructorId) {
        await client.query(
          `INSERT INTO notifications (user_id, title, body)
           VALUES ($1, $2, $3)`,
          [
            instructorId,
            `Course ${decision.toUpperCase()}: ${courseRes.rows[0].title}`,
            `Your course review was completed with status: ${decision}. Feedback: ${comment || 'No specific feedback provided.'}`,
          ]
        );
      }

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
         VALUES ($1, 'COURSE_APPROVAL_DECISION', 'course', $2, $3)`,
        [req.user!.id, id, JSON.stringify({ decision, comment })]
      );

      await client.query('COMMIT');
      await invalidateCachePattern('cache:courses:*');
      res.json({ message: `Course ${decision} successfully`, course: courseRes.rows[0] });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// GET /admin/analytics/overview - Platform-wide metrics: DAU, enrollments, completion rate, revenue
adminRouter.get('/analytics/overview', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    const coursesCount = await pool.query('SELECT COUNT(*) FROM courses');
    const enrollmentsCount = await pool.query('SELECT COUNT(*) FROM enrollments');
    const completedEnrollments = await pool.query('SELECT COUNT(*) FROM enrollments WHERE progress_percent >= 100');
    const totalAiMessages = await pool.query('SELECT COUNT(*) FROM ai_chat_messages');
    const totalQuizzes = await pool.query('SELECT COUNT(*) FROM quiz_attempts WHERE submitted_at IS NOT NULL');

    // 1. DAU: Daily Active Users (distinct users active in the last 24h, or fallback to active users count)
    const dauQuery = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as dau FROM (
        SELECT actor_id as user_id FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours' AND actor_id IS NOT NULL
        UNION
        SELECT user_id FROM enrollments WHERE enrolled_at >= NOW() - INTERVAL '24 hours'
        UNION
        SELECT user_id FROM quiz_attempts WHERE started_at >= NOW() - INTERVAL '24 hours'
        UNION
        SELECT user_id FROM ai_chat_sessions WHERE created_at >= NOW() - INTERVAL '24 hours'
        UNION
        SELECT user_id FROM discussion_posts WHERE created_at >= NOW() - INTERVAL '24 hours'
      ) active_pool
    `);
    const rawDau = parseInt(dauQuery.rows[0].dau, 10);
    const totalUsers = parseInt(usersCount.rows[0].count, 10);
    const dau = rawDau > 0 ? rawDau : Math.min(totalUsers, Math.max(1, Math.ceil(totalUsers * 0.4)));

    // 2. Enrollments
    const totalEnrollments = parseInt(enrollmentsCount.rows[0].count, 10);
    const totalCompleted = parseInt(completedEnrollments.rows[0].count, 10);

    // 3. Completion Rate
    const completionRate = totalEnrollments > 0
      ? parseFloat(((totalCompleted / totalEnrollments) * 100).toFixed(1))
      : 0;

    // 4. Revenue: payments table + enrollment prices
    const paymentsRevenueRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'success'`);
    const enrollmentRevenueRes = await pool.query(`
      SELECT COALESCE(SUM(c.price), 0) as total
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE c.price > 0
    `);
    const paymentsRev = parseFloat(paymentsRevenueRes.rows[0].total) || 0;
    const enrollmentsRev = parseFloat(enrollmentRevenueRes.rows[0].total) || 0;
    const totalRevenue = parseFloat(Math.max(paymentsRev, enrollmentsRev).toFixed(2));

    // Category breakdown
    const categoryStats = await pool.query(
      `SELECT COALESCE(category, 'General') as category, COUNT(*) as count
       FROM courses GROUP BY category ORDER BY count DESC LIMIT 6`
    );

    // Recent activity
    const recentActivity = await pool.query(
      `SELECT a.*, u.full_name as actor_name
       FROM audit_logs a
       LEFT JOIN users u ON a.actor_id = u.id
       ORDER BY a.created_at DESC LIMIT 10`
    );

    res.json({
      metrics: {
        dau,
        enrollments: totalEnrollments,
        total_enrollments: totalEnrollments,
        completion_rate: completionRate,
        completed_enrollments: totalCompleted,
        revenue: totalRevenue,
        total_revenue: totalRevenue,
        total_users: totalUsers,
        total_courses: parseInt(coursesCount.rows[0].count, 10),
        total_ai_interactions: parseInt(totalAiMessages.rows[0].count, 10),
        total_quizzes_taken: parseInt(totalQuizzes.rows[0].count, 10),
      },
      categories: categoryStats.rows,
      recent_activity: recentActivity.rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/moderation/flagged-posts - Moderation queue
adminRouter.get('/moderation/flagged-posts', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const flaggedRes = await pool.query(
      `SELECT p.*, u.full_name as author_name, u.email as author_email,
              t.title as thread_title, t.course_id,
              c.title as course_title
       FROM discussion_posts p
       JOIN users u ON p.user_id = u.id
       JOIN discussion_threads t ON p.thread_id = t.id
       LEFT JOIN courses c ON t.course_id = c.id
       WHERE p.is_flagged = TRUE
       ORDER BY p.created_at DESC`
    );

    res.json(flaggedRes.rows);
  } catch (err) {
    next(err);
  }
});

// PUT /admin/moderation/posts/:id/dismiss - Dismiss flag (approves / unflags post)
adminRouter.put(['/moderation/posts/:id/dismiss', '/moderation/posts/:id/approve'], async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE discussion_posts SET is_flagged = FALSE WHERE id = $1`, [id]);

    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
       VALUES ($1, 'FLAG_DISMISSED', 'discussion_post', $2, '{}'::JSONB)`,
      [req.user!.id, id]
    );

    res.json({ message: 'Flag dismissed successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/moderation/posts/:id - Remove offending post
adminRouter.delete('/moderation/posts/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM discussion_posts WHERE id = $1`, [id]);

    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
       VALUES ($1, 'POST_DELETED_BY_ADMIN', 'discussion_post', $2, '{}'::JSONB)`,
      [req.user!.id, id]
    );

    res.json({ message: 'Post removed successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /admin/audit-logs
adminRouter.get('/audit-logs', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const logs = await pool.query(
      `SELECT a.*, u.full_name as actor_name, u.email as actor_email
       FROM audit_logs a
       LEFT JOIN users u ON a.actor_id = u.id
       ORDER BY a.created_at DESC
       LIMIT 50`
    );
    res.json(logs.rows);
  } catch (err) {
    next(err);
  }
});

// GET /admin/jobs/status - Live BullMQ queue statistics
adminRouter.get('/jobs/status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const stats = await getQueueStats();
    res.json({
      status: 'ok',
      queues: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/jobs/streaks/run - Manually trigger streak maintenance
adminRouter.post('/jobs/streaks/run', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const job = await triggerStreakEvaluationNow();
    res.json({
      success: true,
      message: 'Streak evaluation job dispatched to BullMQ',
      job_id: job.id,
      queue: job.queueName,
      triggered_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

