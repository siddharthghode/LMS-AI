import { Router, Response } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth';

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

    if (role) {
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

// PUT /admin/users/:id/role - Update user role
adminRouter.put('/users/:id/role', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

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

    res.json({ message: `Role updated to ${role} successfully` });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/users/:id/suspend - Suspend/activate account
adminRouter.put('/users/:id/suspend', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

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

// GET /admin/analytics/overview - Platform-wide metrics
adminRouter.get('/analytics/overview', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    const coursesCount = await pool.query('SELECT COUNT(*) FROM courses');
    const enrollmentsCount = await pool.query('SELECT COUNT(*) FROM enrollments');
    const completedEnrollments = await pool.query('SELECT COUNT(*) FROM enrollments WHERE progress_percent >= 100');
    const totalAiMessages = await pool.query('SELECT COUNT(*) FROM ai_chat_messages');
    const totalQuizzes = await pool.query('SELECT COUNT(*) FROM quiz_attempts WHERE submitted_at IS NOT NULL');

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
        total_users: parseInt(usersCount.rows[0].count, 10),
        total_courses: parseInt(coursesCount.rows[0].count, 10),
        total_enrollments: parseInt(enrollmentsCount.rows[0].count, 10),
        completed_enrollments: parseInt(completedEnrollments.rows[0].count, 10),
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

// PUT /admin/moderation/posts/:id/dismiss - Dismiss flag
adminRouter.put('/moderation/posts/:id/dismiss', async (req: AuthenticatedRequest, res: Response, next) => {
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
