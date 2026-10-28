import { Router, Response } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth';

export const quizzesRouter = Router();

// GET /courses/:id/quizzes
quizzesRouter.get('/courses/:id/quizzes', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: courseId } = req.params;

    const quizzesRes = await pool.query(
      `SELECT q.*, m.title as module_title,
              (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) as question_count,
              (SELECT qa.score FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.user_id = $2 AND qa.submitted_at IS NOT NULL ORDER BY qa.score DESC LIMIT 1) as best_score
       FROM quizzes q
       JOIN modules m ON q.module_id = m.id
       WHERE m.course_id = $1`,
      [courseId, req.user!.id]
    );

    res.json(quizzesRes.rows);
  } catch (err) {
    next(err);
  }
});

// GET /quizzes/:id
quizzesRouter.get('/quizzes/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const isInstructorOrAdmin = ['instructor', 'admin'].includes(req.user!.role);

    const quizRes = await pool.query(`SELECT * FROM quizzes WHERE id = $1`, [id]);
    if (quizRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Quiz not found' } });
      return;
    }

    const quiz = quizRes.rows[0];

    const questionsRes = await pool.query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY order_index ASC`,
      [id]
    );

    const questionsWithOpts = await Promise.all(
      questionsRes.rows.map(async (q) => {
        const optsRes = await pool.query(
          isInstructorOrAdmin
            ? `SELECT id, option_text, is_correct FROM quiz_options WHERE question_id = $1`
            : `SELECT id, option_text FROM quiz_options WHERE question_id = $1`,
          [q.id]
        );
        return {
          ...q,
          options: optsRes.rows,
        };
      })
    );

    res.json({
      ...quiz,
      questions: questionsWithOpts,
    });
  } catch (err) {
    next(err);
  }
});

// POST /quizzes - Create quiz manually (instructor / admin)
quizzesRouter.post('/quizzes', authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { module_id, title, is_ai_generated, generated_from_lecture_id, questions } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const quizRes = await client.query(
        `INSERT INTO quizzes (module_id, title, is_ai_generated, generated_from_lecture_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [module_id, title, is_ai_generated ?? false, generated_from_lecture_id || null]
      );
      const quiz = quizRes.rows[0];

      if (Array.isArray(questions)) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const qRes = await client.query(
            `INSERT INTO quiz_questions (quiz_id, question_text, question_type, order_index)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [quiz.id, q.question_text, q.question_type || 'mcq', i + 1]
          );
          const qId = qRes.rows[0].id;

          if (Array.isArray(q.options)) {
            for (const opt of q.options) {
              await client.query(
                `INSERT INTO quiz_options (question_id, option_text, is_correct)
                 VALUES ($1, $2, $3)`,
                [qId, opt.option_text, opt.is_correct ?? false]
              );
            }
          }
        }
      }

      await client.query('COMMIT');
      res.status(201).json(quiz);
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

// POST /quizzes/:id/attempt - Start an attempt
quizzesRouter.post('/quizzes/:id/attempt', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: quizId } = req.params;
    const userId = req.user!.id;

    const attemptRes = await pool.query(
      `INSERT INTO quiz_attempts (quiz_id, user_id, started_at)
       VALUES ($1, $2, now())
       RETURNING *`,
      [quizId, userId]
    );

    res.status(201).json(attemptRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /attempts/:id/submit - Submit answers, auto-grade
quizzesRouter.post('/attempts/:id/submit', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: attemptId } = req.params;
    const { answers } = req.body; // array of { question_id, selected_option_id or selected_option_ids, text_answer }
    const userId = req.user!.id;

    const attemptCheck = await pool.query(
      `SELECT * FROM quiz_attempts WHERE id = $1 AND user_id = $2`,
      [attemptId, userId]
    );

    if (attemptCheck.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Attempt not found' } });
      return;
    }

    const quizId = attemptCheck.rows[0].quiz_id;

    // Fetch questions and correct options
    const questionsRes = await pool.query(
      `SELECT qq.id as question_id, qq.question_text,
              qo.id as correct_option_id, qo.option_text as correct_option_text
       FROM quiz_questions qq
       LEFT JOIN quiz_options qo ON qq.id = qo.question_id AND qo.is_correct = TRUE
       WHERE qq.quiz_id = $1`,
      [quizId]
    );

    const questionsMap = new Map<string, string>();
    for (const row of questionsRes.rows) {
      questionsMap.set(row.question_id, row.correct_option_id);
    }

    let correctCount = 0;
    const totalQuestions = questionsRes.rows.length || 1;
    const reviewBreakdown = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const ans of (answers || [])) {
        const correctOptId = questionsMap.get(ans.question_id);
        const selectedId = ans.selected_option_id || (Array.isArray(ans.selected_option_ids) ? ans.selected_option_ids[0] : null);
        const isCorrect = selectedId && correctOptId && selectedId === correctOptId;

        if (isCorrect) correctCount++;

        const optIds = selectedId ? [selectedId] : [];
        await client.query(
          `INSERT INTO quiz_answers (attempt_id, question_id, selected_option_ids, text_answer, is_correct)
           VALUES ($1, $2, $3, $4, $5)`,
          [attemptId, ans.question_id, optIds, ans.text_answer || null, isCorrect]
        );

        reviewBreakdown.push({
          question_id: ans.question_id,
          selected_option_id: selectedId,
          correct_option_id: correctOptId,
          is_correct: isCorrect,
        });
      }

      const score = Math.round((correctCount / totalQuestions) * 100);

      const updatedAttempt = await client.query(
        `UPDATE quiz_attempts
         SET score = $1, submitted_at = now()
         WHERE id = $2
         RETURNING *`,
        [score, attemptId]
      );

      // If scored 100%, award Quiz Master badge (id 2)
      if (score === 100) {
        await client.query(
          `INSERT INTO user_badges (user_id, badge_id)
           VALUES ($1, 2)
           ON CONFLICT DO NOTHING`,
          [userId]
        );
      }

      await client.query('COMMIT');

      res.json({
        attempt: updatedAttempt.rows[0],
        score,
        total_questions: totalQuestions,
        correct_count: correctCount,
        review: reviewBreakdown,
      });
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
