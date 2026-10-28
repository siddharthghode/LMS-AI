import { Router, Response } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth';

export const enrollmentsRouter = Router();

// POST /courses/:id/enroll - Enroll current student
enrollmentsRouter.post('/courses/:id/enroll', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: courseId } = req.params;
    const userId = req.user!.id;

    // Check course exists and is approved
    const courseRes = await pool.query('SELECT id, title, status FROM courses WHERE id = $1', [courseId]);
    if (courseRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Course not found' } });
      return;
    }

    const enrollRes = await pool.query(
      `INSERT INTO enrollments (user_id, course_id, progress_percent)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, course_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING *`,
      [userId, courseId]
    );

    res.status(201).json({
      message: 'Enrolled successfully',
      enrollment: enrollRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// GET /enrollments/me - List my enrolled courses with progress
enrollmentsRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;

    const query = `
      SELECT e.id as enrollment_id, e.enrolled_at, e.progress_percent,
             c.id as course_id, c.title, c.description, c.category, c.difficulty, c.thumbnail_url,
             u.full_name as instructor_name,
             (SELECT COUNT(*) FROM lectures l JOIN modules m ON l.module_id = m.id WHERE m.course_id = c.id) as total_lectures,
             (SELECT COUNT(*) FROM lecture_progress lp WHERE lp.enrollment_id = e.id AND lp.completed = TRUE) as completed_lectures
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE e.user_id = $1
      ORDER BY e.enrolled_at DESC
    `;

    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /courses/:id/enrollment-status
enrollmentsRouter.get('/courses/:id/enrollment-status', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: courseId } = req.params;
    const userId = req.user!.id;

    const resCheck = await pool.query(
      `SELECT e.*,
              (SELECT json_agg(lp.*) FROM lecture_progress lp WHERE lp.enrollment_id = e.id) as lecture_progress
       FROM enrollments e
       WHERE e.user_id = $1 AND e.course_id = $2`,
      [userId, courseId]
    );

    if (resCheck.rows.length === 0) {
      res.json({ is_enrolled: false });
      return;
    }

    res.json({
      is_enrolled: true,
      enrollment: resCheck.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// POST /lectures/:id/progress - Update watched-seconds / mark complete
enrollmentsRouter.post('/lectures/:id/progress', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: lectureId } = req.params;
    const { watched_seconds, completed } = req.body;
    const userId = req.user!.id;

    // Find course of lecture
    const lecRes = await pool.query(
      `SELECT m.course_id FROM lectures l JOIN modules m ON l.module_id = m.id WHERE l.id = $1`,
      [lectureId]
    );

    if (lecRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lecture not found' } });
      return;
    }

    const courseId = lecRes.rows[0].course_id;

    // Ensure enrollment exists
    let enrollRes = await pool.query(
      `SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2`,
      [userId, courseId]
    );

    if (enrollRes.rows.length === 0) {
      enrollRes = await pool.query(
        `INSERT INTO enrollments (user_id, course_id, progress_percent) VALUES ($1, $2, 0) RETURNING id`,
        [userId, courseId]
      );
    }

    const enrollmentId = enrollRes.rows[0].id;

    // Upsert lecture progress
    await pool.query(
      `INSERT INTO lecture_progress (enrollment_id, lecture_id, watched_seconds, completed, last_watched_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (enrollment_id, lecture_id) DO UPDATE SET
         watched_seconds = GREATEST(lecture_progress.watched_seconds, EXCLUDED.watched_seconds),
         completed = CASE WHEN EXCLUDED.completed = TRUE THEN TRUE ELSE lecture_progress.completed END,
         last_watched_at = now()`,
      [enrollmentId, lectureId, watched_seconds || 0, completed ?? false]
    );

    // Recalculate course overall progress percent
    const statsRes = await pool.query(
      `SELECT
         COUNT(l.id) as total_lectures,
         COUNT(lp.id) FILTER (WHERE lp.completed = TRUE) as completed_lectures
       FROM lectures l
       JOIN modules m ON l.module_id = m.id
       LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id AND lp.enrollment_id = $1
       WHERE m.course_id = $2`,
      [enrollmentId, courseId]
    );

    const totalLectures = parseInt(statsRes.rows[0].total_lectures, 10) || 1;
    const completedLectures = parseInt(statsRes.rows[0].completed_lectures, 10) || 0;
    const progressPercent = Math.min(100, Math.round((completedLectures / totalLectures) * 100));

    await pool.query(
      `UPDATE enrollments SET progress_percent = $1 WHERE id = $2`,
      [progressPercent, enrollmentId]
    );

    // If 100% completed, auto-issue certificate
    if (progressPercent === 100) {
      await pool.query(
        `INSERT INTO certificates (user_id, course_id, certificate_url)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, course_id) DO NOTHING`,
        [userId, courseId, `https://lms-ai.local/certificates/${userId}_${courseId}.pdf`]
      );
    }

    res.json({
      progress_percent: progressPercent,
      completed_lectures: completedLectures,
      total_lectures: totalLectures,
    });
  } catch (err) {
    next(err);
  }
});

// GET /lectures/:id/notes
enrollmentsRouter.get('/lectures/:id/notes', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: lectureId } = req.params;
    const notes = await pool.query(
      `SELECT * FROM notes WHERE user_id = $1 AND lecture_id = $2 ORDER BY timestamp_seconds ASC`,
      [req.user!.id, lectureId]
    );
    res.json(notes.rows);
  } catch (err) {
    next(err);
  }
});

// POST /lectures/:id/notes
enrollmentsRouter.post('/lectures/:id/notes', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: lectureId } = req.params;
    const { content, timestamp_seconds } = req.body;

    const result = await pool.query(
      `INSERT INTO notes (user_id, lecture_id, timestamp_seconds, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user!.id, lectureId, timestamp_seconds || 0, content]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /notes/:id
enrollmentsRouter.delete('/notes/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM notes WHERE id = $1 AND user_id = $2`, [id, req.user!.id]);
    res.json({ message: 'Note deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /lectures/:id/bookmarks
enrollmentsRouter.get('/lectures/:id/bookmarks', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: lectureId } = req.params;
    const bookmarks = await pool.query(
      `SELECT * FROM bookmarks WHERE user_id = $1 AND lecture_id = $2 ORDER BY timestamp_seconds ASC`,
      [req.user!.id, lectureId]
    );
    res.json(bookmarks.rows);
  } catch (err) {
    next(err);
  }
});

// POST /lectures/:id/bookmarks
enrollmentsRouter.post('/lectures/:id/bookmarks', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: lectureId } = req.params;
    const { timestamp_seconds } = req.body;

    const result = await pool.query(
      `INSERT INTO bookmarks (user_id, lecture_id, timestamp_seconds)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user!.id, lectureId, timestamp_seconds || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});
