import { Router, Response } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth';

export const gamificationRouter = Router();

// GET /users/me/badges
gamificationRouter.get('/users/me/badges', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const badgesRes = await pool.query(
      `SELECT b.*, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [req.user!.id]
    );

    const allBadgesRes = await pool.query('SELECT * FROM badges ORDER BY id ASC');

    res.json({
      earned: badgesRes.rows,
      all: allBadgesRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /users/me/streak
gamificationRouter.get('/users/me/streak', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const streakRes = await pool.query(
      `SELECT * FROM streaks WHERE user_id = $1`,
      [req.user!.id]
    );

    if (streakRes.rows.length === 0) {
      res.json({ current_streak: 1, longest_streak: 1, last_active_date: new Date().toISOString() });
      return;
    }

    res.json(streakRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /leaderboard/:courseId
gamificationRouter.get('/leaderboard/:courseId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { courseId } = req.params;

    const leaderboardRes = await pool.query(
      `SELECT u.id as user_id, u.full_name, u.avatar_url,
              e.progress_percent,
              COALESCE(AVG(qa.score), 0) as avg_quiz_score,
              COALESCE(s.current_streak, 0) as streak,
              ROUND((e.progress_percent * 0.5 + COALESCE(AVG(qa.score), 0) * 0.5)::numeric, 1) as total_points
       FROM enrollments e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN modules m ON m.course_id = e.course_id
       LEFT JOIN quizzes q ON q.module_id = m.id
       LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.user_id = u.id AND qa.submitted_at IS NOT NULL
       LEFT JOIN streaks s ON s.user_id = u.id
       WHERE e.course_id = $1
       GROUP BY u.id, u.full_name, u.avatar_url, e.progress_percent, s.current_streak
       ORDER BY total_points DESC, e.progress_percent DESC
       LIMIT 20`,
      [courseId]
    );

    res.json(leaderboardRes.rows);
  } catch (err) {
    next(err);
  }
});

// GET /recommendations/me
gamificationRouter.get('/recommendations/me', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;

    // Fetch existing stored recommendations or dynamic suggestions based on courses not yet enrolled in
    const recsRes = await pool.query(
      `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.thumbnail_url, c.price,
              'Recommended based on popular demand and your learning interests' as reason,
              92.5 as score
       FROM courses c
       WHERE c.status = 'approved'
         AND c.id NOT IN (SELECT course_id FROM enrollments WHERE user_id = $1)
       LIMIT 4`,
      [userId]
    );

    res.json(recsRes.rows);
  } catch (err) {
    next(err);
  }
});

// GET /certificates/me
gamificationRouter.get('/certificates/me', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const certs = await pool.query(
      `SELECT cert.*, c.title as course_title, c.thumbnail_url as course_thumbnail
       FROM certificates cert
       JOIN courses c ON cert.course_id = c.id
       WHERE cert.user_id = $1
       ORDER BY cert.issued_at DESC`,
      [req.user!.id]
    );
    res.json(certs.rows);
  } catch (err) {
    next(err);
  }
});

// POST /courses/:id/certificate
gamificationRouter.post('/courses/:id/certificate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: courseId } = req.params;
    const userId = req.user!.id;

    // Check completion
    const enrollCheck = await pool.query(
      `SELECT progress_percent FROM enrollments WHERE user_id = $1 AND course_id = $2`,
      [userId, courseId]
    );

    if (enrollCheck.rows.length === 0 || enrollCheck.rows[0].progress_percent < 100) {
      res.status(400).json({
        error: {
          code: 'REQUIREMENTS_NOT_MET',
          message: 'Course must be 100% completed to claim a certificate',
        },
      });
      return;
    }

    const certRes = await pool.query(
      `INSERT INTO certificates (user_id, course_id, certificate_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, course_id) DO UPDATE SET issued_at = now()
       RETURNING *`,
      [userId, courseId, `https://lms-ai.local/certificates/${userId}_${courseId}.pdf`]
    );

    res.status(201).json(certRes.rows[0]);
  } catch (err) {
    next(err);
  }
});
