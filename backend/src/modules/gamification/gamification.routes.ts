import { Router, Response } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth';
import { generateCertificatePdf } from '../../utils/certificate';
import { cacheMiddleware } from '../../utils/cache';

export const gamificationRouter = Router();

// GET /users/me/badges
gamificationRouter.get(['/users/me/badges', '/me/badges', '/badges'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
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
gamificationRouter.get(['/users/me/streak', '/me/streak', '/streak'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
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

// GET /mastery/me - Student topic mastery scores (FR-A8)
gamificationRouter.get(['/mastery/me', '/users/me/mastery', '/me/mastery'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const masteryRes = await pool.query(
      `SELECT id, topic, mastery_score::float, quizzes_evaluated, updated_at
       FROM user_topic_mastery
       WHERE user_id = $1
       ORDER BY mastery_score DESC`,
      [req.user!.id]
    );

    const overallAvg = masteryRes.rows.length > 0
      ? Math.round(masteryRes.rows.reduce((acc, m) => acc + m.mastery_score, 0) / masteryRes.rows.length)
      : 80;

    const recommendedMode = overallAvg < 50 ? 'beginner' : overallAvg < 80 ? 'intermediate' : 'advanced';

    res.json({
      user_id: req.user!.id,
      topics: masteryRes.rows,
      overall_mastery: overallAvg,
      recommended_mode: recommendedMode,
    });
  } catch (err) {
    next(err);
  }
});

// GET /leaderboard/:courseId (Cached TTL 60 sec)
gamificationRouter.get(['/leaderboard/:courseId', '/:courseId'], authenticateToken, cacheMiddleware(60, 'cache:leaderboard'), async (req: AuthenticatedRequest, res: Response, next) => {
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

// GET /recommendations/me - Dynamic rule-based + category affinity recommendations
gamificationRouter.get(['/recommendations/me', '/me'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;

    // 1. Analyze student's enrolled courses and quiz scores to derive category interest & skill level
    const userProfileRes = await pool.query(
      `SELECT c.category, c.difficulty, COALESCE(AVG(qa.score), 0) as avg_score
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       LEFT JOIN modules m ON m.course_id = c.id
       LEFT JOIN quizzes q ON q.module_id = m.id
       LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.user_id = $1
       WHERE e.user_id = $1
       GROUP BY c.category, c.difficulty
       ORDER BY avg_score DESC`,
      [userId]
    );

    const preferredCategory = userProfileRes.rows.length > 0 ? userProfileRes.rows[0].category : null;
    const avgScore = userProfileRes.rows.length > 0 ? parseFloat(userProfileRes.rows[0].avg_score) : 75;

    // 2. Query unenrolled approved courses, prioritizing preferred category and matching difficulty
    const recsRes = await pool.query(
      `SELECT c.id, c.title, c.description, c.category, c.difficulty, c.thumbnail_url, c.price,
              CASE
                WHEN c.category = $2 THEN 'Recommended based on your active progress in ' || $2
                WHEN $3 >= 80 AND c.difficulty = 'advanced' THEN 'Level up: Recommended advanced curriculum for top performers'
                WHEN $3 < 70 AND c.difficulty = 'beginner' THEN 'Foundational refresher to strengthen your core concepts'
                ELSE 'Popular course aligned with your learning profile'
              END as reason,
              CASE
                WHEN c.category = $2 THEN 96.0
                WHEN $3 >= 80 AND c.difficulty = 'advanced' THEN 92.5
                ELSE 88.0
              END as score
       FROM courses c
       WHERE c.status = 'approved'
         AND c.id NOT IN (SELECT course_id FROM enrollments WHERE user_id = $1)
       ORDER BY (CASE WHEN c.category = $2 THEN 1 ELSE 2 END), score DESC
       LIMIT 4`,
      [userId, preferredCategory || 'Artificial Intelligence', avgScore]
    );

    res.json(recsRes.rows);
  } catch (err) {
    next(err);
  }
});

// GET /certificates/me
gamificationRouter.get(['/certificates/me', '/me'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
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
gamificationRouter.post(['/courses/:id/certificate', '/:id/certificate', '/:id'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
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

    let certUrl = `/uploads/certificates/cert_${userId}_${courseId}.pdf`;
    try {
      const userRes = await pool.query('SELECT full_name FROM users WHERE id = $1', [userId]);
      const courseRes = await pool.query('SELECT title FROM courses WHERE id = $1', [courseId]);
      const studentName = userRes.rows[0]?.full_name || 'Valued Learner';
      const courseTitle = courseRes.rows[0]?.title || 'Professional Course';
      certUrl = await generateCertificatePdf({
        userId,
        studentName,
        courseId,
        courseTitle,
      });
    } catch (pdfErr) {
      console.error('Certificate PDF generation error:', pdfErr);
    }

    const certRes = await pool.query(
      `INSERT INTO certificates (user_id, course_id, certificate_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, course_id) DO UPDATE SET certificate_url = EXCLUDED.certificate_url, issued_at = now()
       RETURNING *`,
      [userId, courseId, certUrl]
    );

    res.status(201).json(certRes.rows[0]);
  } catch (err) {
    next(err);
  }
});
