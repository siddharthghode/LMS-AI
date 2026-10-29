import request from 'supertest';
import { app } from '../src/server';
import { pool } from '../src/config/db';

describe('Quiz Evaluation & Multi-Type Grading Engine Tests', () => {
  let studentToken = '';
  let quizId = '';
  let mcqQuestionId = '';
  let mcqCorrectOptId = '';
  let multiQuestionId = '';
  let multiCorrectOptIds: string[] = [];
  let shortQuestionId = '';

  beforeAll(async () => {
    // 1. Fetch or create a quiz directly from DB
    const qList = await pool.query('SELECT id FROM quizzes ORDER BY id ASC LIMIT 1');
    if (qList.rows.length > 0) {
      quizId = qList.rows[0].id;
    } else {
      const cRes = await pool.query(
        `INSERT INTO courses (title, category, difficulty) VALUES ('Test Quiz Course', 'Artificial Intelligence', 'beginner') RETURNING id`
      );
      const mRes = await pool.query(
        `INSERT INTO modules (course_id, title, order_index) VALUES ($1, 'Test Module', 1) RETURNING id`,
        [cRes.rows[0].id]
      );
      const newQuiz = await pool.query(
        `INSERT INTO quizzes (module_id, title) VALUES ($1, 'Test Grading Quiz') RETURNING id`,
        [mRes.rows[0].id]
      );
      quizId = newQuiz.rows[0].id;
    }

    // 2. Ensure MCQ question exists
    const mcqCheck = await pool.query(
      `SELECT id FROM quiz_questions WHERE quiz_id = $1 AND question_type = 'mcq'`,
      [quizId]
    );
    if (mcqCheck.rows.length === 0) {
      const qRes = await pool.query(
        `INSERT INTO quiz_questions (quiz_id, question_text, question_type, order_index)
         VALUES ($1, 'Why is Cosine Similarity preferred over Euclidean Distance?', 'mcq', 1)
         RETURNING id`,
        [quizId]
      );
      mcqQuestionId = qRes.rows[0].id;
      const opt = await pool.query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1, 'Cosine similarity is invariant to vector magnitude', true) RETURNING id`,
        [mcqQuestionId]
      );
      await pool.query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1, 'Euclidean distance cannot be computed in 3D', false)`,
        [mcqQuestionId]
      );
      mcqCorrectOptId = opt.rows[0].id;
    } else {
      mcqQuestionId = mcqCheck.rows[0].id;
      const opt = await pool.query(
        `SELECT id FROM quiz_options WHERE question_id = $1 AND is_correct = true LIMIT 1`,
        [mcqQuestionId]
      );
      mcqCorrectOptId = opt.rows[0]?.id;
    }

    // 3. Ensure multi_select question exists
    const multiCheck = await pool.query(
      `SELECT id FROM quiz_questions WHERE quiz_id = $1 AND question_type = 'multi_select'`,
      [quizId]
    );
    if (multiCheck.rows.length === 0) {
      const qRes = await pool.query(
        `INSERT INTO quiz_questions (quiz_id, question_text, question_type, order_index)
         VALUES ($1, 'Select all valid vector distance metrics supported in pgvector:', 'multi_select', 2)
         RETURNING id`,
        [quizId]
      );
      multiQuestionId = qRes.rows[0].id;
      const opt1 = await pool.query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1, 'Cosine distance (<=>)', true) RETURNING id`,
        [multiQuestionId]
      );
      const opt2 = await pool.query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1, 'L2 distance (<->)', true) RETURNING id`,
        [multiQuestionId]
      );
      await pool.query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1, 'MD5 hash distance', false)`,
        [multiQuestionId]
      );
      multiCorrectOptIds = [opt1.rows[0].id, opt2.rows[0].id];
    } else {
      multiQuestionId = multiCheck.rows[0].id;
      const opts = await pool.query(
        `SELECT id FROM quiz_options WHERE question_id = $1 AND is_correct = true`,
        [multiQuestionId]
      );
      multiCorrectOptIds = opts.rows.map(r => r.id);
    }

    // 4. Ensure short_answer question exists
    const shortCheck = await pool.query(
      `SELECT id FROM quiz_questions WHERE quiz_id = $1 AND question_type = 'short_answer'`,
      [quizId]
    );
    if (shortCheck.rows.length === 0) {
      const qRes = await pool.query(
        `INSERT INTO quiz_questions (quiz_id, question_text, question_type, order_index)
         VALUES ($1, 'Name the open-source PostgreSQL extension used for vector similarity search:', 'short_answer', 3)
         RETURNING id`,
        [quizId]
      );
      shortQuestionId = qRes.rows[0].id;
      await pool.query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1, 'pgvector', true)`,
        [shortQuestionId]
      );
    } else {
      shortQuestionId = shortCheck.rows[0].id;
    }

    // 5. Login as student
    const studentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@lms.local', password: 'Password123!' });
    studentToken = studentRes.body.access_token;
  });

  it('POST /api/v1/quizzes/:id/attempt - Should start a quiz attempt for student', async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quizId}/attempt`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.quiz_id).toBe(quizId);
  });

  it('POST /api/v1/attempts/:id/submit - Should grade multi-type answers accurately', async () => {
    // Start attempt
    const attemptRes = await request(app)
      .post(`/api/v1/quizzes/${quizId}/attempt`)
      .set('Authorization', `Bearer ${studentToken}`);
    const attemptId = attemptRes.body.id;

    // Submit with all correct answers
    const answers: any[] = [];
    if (mcqQuestionId) answers.push({ question_id: mcqQuestionId, selected_option_id: mcqCorrectOptId });
    if (multiQuestionId) answers.push({ question_id: multiQuestionId, selected_option_ids: multiCorrectOptIds });
    if (shortQuestionId) answers.push({ question_id: shortQuestionId, text_answer: 'pgvector' });

    const submitRes = await request(app)
      .post(`/api/v1/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body).toHaveProperty('score');
    expect(submitRes.body).toHaveProperty('review');

    // Verify individual question evaluations
    if (mcqQuestionId) {
      const mcqRev = submitRes.body.review.find((r: any) => r.question_id === mcqQuestionId);
      expect(mcqRev?.is_correct).toBe(true);
    }

    if (multiQuestionId) {
      const multiRev = submitRes.body.review.find((r: any) => r.question_id === multiQuestionId);
      expect(multiRev?.is_correct).toBe(true);
    }

    if (shortQuestionId) {
      const shortRev = submitRes.body.review.find((r: any) => r.question_id === shortQuestionId);
      expect(shortRev?.is_correct).toBe(true);
    }
  });
});
