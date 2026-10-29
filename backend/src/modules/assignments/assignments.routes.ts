import { Router, Response } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth';

export const assignmentsRouter = Router();

// GET /courses/:id/assignments
assignmentsRouter.get(['/courses/:id/assignments', '/:id/assignments'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: courseId } = req.params;
    const userId = req.user!.id;

    const assignmentsRes = await pool.query(
      `SELECT a.*,
              sub.id as submission_id, sub.submitted_at, sub.grade, sub.feedback, sub.file_url, sub.text_submission
       FROM assignments a
       LEFT JOIN assignment_submissions sub ON a.id = sub.assignment_id AND sub.user_id = $2
       WHERE a.course_id = $1
       ORDER BY a.due_date ASC NULLS LAST`,
      [courseId, userId]
    );

    res.json(assignmentsRes.rows);
  } catch (err) {
    next(err);
  }
});

// GET /submissions/me - Student's submissions with grades & feedback
assignmentsRouter.get(['/submissions/me', '/me'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const subsRes = await pool.query(
      `SELECT sub.*, a.title as assignment_title, a.course_id
       FROM assignment_submissions sub
       JOIN assignments a ON sub.assignment_id = a.id
       WHERE sub.user_id = $1
       ORDER BY sub.submitted_at DESC`,
      [req.user!.id]
    );
    res.json(subsRes.rows);
  } catch (err) {
    next(err);
  }
});

// GET /assignments/queue - All submissions across courses for instructor/admin grading queue
assignmentsRouter.get(['/queue', '/instructor/all'], authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const subsRes = await pool.query(
      `SELECT sub.*, a.title as assignment_title, c.title as course_title,
              u.full_name as student_name, u.email as student_email, u.avatar_url as student_avatar
       FROM assignment_submissions sub
       JOIN assignments a ON sub.assignment_id = a.id
       JOIN courses c ON a.course_id = c.id
       JOIN users u ON sub.user_id = u.id
       ORDER BY sub.submitted_at DESC`
    );
    res.json(subsRes.rows);
  } catch (err) {
    next(err);
  }
});

// GET /assignments/:id
assignmentsRouter.get(['/assignments/:id', '/:id'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const assignmentRes = await pool.query('SELECT * FROM assignments WHERE id = $1', [id]);
    if (assignmentRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
      return;
    }

    res.json(assignmentRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /assignments - Create assignment (instructor / admin)
assignmentsRouter.post(['/assignments', '/'], authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { course_id, title, instructions, rubric, due_date } = req.body;

    const insertRes = await pool.query(
      `INSERT INTO assignments (course_id, title, instructions, rubric, due_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [course_id, title, instructions, rubric ? JSON.stringify(rubric) : null, due_date || null]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /assignments/:id/submit - Submit assignment (student)
assignmentsRouter.post(['/assignments/:id/submit', '/:id/submit'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: assignmentId } = req.params;
    const { file_url, text_submission } = req.body;
    const userId = req.user!.id;

    const subRes = await pool.query(
      `INSERT INTO assignment_submissions (assignment_id, user_id, file_url, text_submission, submitted_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING *`,
      [assignmentId, userId, file_url || null, text_submission || null]
    );

    // Award Code Pioneer badge (id 4)
    await pool.query(
      `INSERT INTO user_badges (user_id, badge_id) VALUES ($1, 4) ON CONFLICT DO NOTHING`,
      [userId]
    );

    res.status(201).json(subRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /assignments/:id/submissions - View submissions (instructor / admin)
assignmentsRouter.get(['/assignments/:id/submissions', '/:id/submissions'], authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: assignmentId } = req.params;

    const subsRes = await pool.query(
      `SELECT sub.*, u.full_name as student_name, u.email as student_email, u.avatar_url as student_avatar
       FROM assignment_submissions sub
       JOIN users u ON sub.user_id = u.id
       WHERE sub.assignment_id = $1
       ORDER BY sub.submitted_at DESC`,
      [assignmentId]
    );

    res.json(subsRes.rows);
  } catch (err) {
    next(err);
  }
});

// PUT /submissions/:id/grade - Grade a submission (instructor / admin)
assignmentsRouter.put(['/submissions/:id/grade', '/:id/grade'], authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: submissionId } = req.params;
    const { grade, feedback } = req.body;

    const updateRes = await pool.query(
      `UPDATE assignment_submissions
       SET grade = $1, feedback = $2
       WHERE id = $3
       RETURNING *`,
      [grade, feedback, submissionId]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Submission not found' } });
      return;
    }

    const sub = updateRes.rows[0];

    // Send notification to student
    await pool.query(
      `INSERT INTO notifications (user_id, title, body)
       VALUES ($1, 'Assignment Graded', $2)`,
      [sub.user_id, `Your assignment submission received a score of ${grade}%. Feedback: ${feedback || 'Good work!'}`]
    );

    res.json(sub);
  } catch (err) {
    next(err);
  }
});
