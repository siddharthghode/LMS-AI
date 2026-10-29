import request from 'supertest';
import { app } from '../src/server';

describe('Quiz Evaluation & Multi-Type Grading Engine Tests', () => {
  let studentToken = '';
  let quizId = '';
  let mcqQuestionId = '';
  let mcqCorrectOptId = '';
  let multiQuestionId = '';
  let multiCorrectOptIds: string[] = [];
  let shortQuestionId = '';

  beforeAll(async () => {
    // 1. Login as instructor to view correct option IDs
    const instRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'instructor@lms.local', password: 'Password123!' });
    const instToken = instRes.body.access_token;

    // 2. Fetch seeded quiz
    const courseRes = await request(app)
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${instToken}`);
    const course = courseRes.body.data.find((c: any) => c.title.includes('Full-Stack AI')) || courseRes.body.data[0];
    const courseId = course.id;

    const quizListRes = await request(app)
      .get(`/api/v1/quizzes/courses/${courseId}/quizzes`)
      .set('Authorization', `Bearer ${instToken}`);
    quizId = quizListRes.body[0].id;

    const quizDetailRes = await request(app)
      .get(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${instToken}`);

    for (const q of quizDetailRes.body.questions) {
      if (q.question_type === 'mcq' && !mcqQuestionId) {
        mcqQuestionId = q.id;
        mcqCorrectOptId = q.options.find((o: any) => o.is_correct)?.id;
      } else if (q.question_type === 'multi_select' && !multiQuestionId) {
        multiQuestionId = q.id;
        multiCorrectOptIds = q.options.filter((o: any) => o.is_correct).map((o: any) => o.id);
      } else if (q.question_type === 'short_answer' && !shortQuestionId) {
        shortQuestionId = q.id;
      }
    }

    // 3. Login as student
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
    const answers = [
      { question_id: mcqQuestionId, selected_option_id: mcqCorrectOptId },
      { question_id: multiQuestionId, selected_option_ids: multiCorrectOptIds },
      { question_id: shortQuestionId, text_answer: 'pgvector' },
    ];

    const submitRes = await request(app)
      .post(`/api/v1/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body).toHaveProperty('score');
    expect(submitRes.body).toHaveProperty('review');

    // Verify individual question evaluations
    const mcqRev = submitRes.body.review.find((r: any) => r.question_id === mcqQuestionId);
    expect(mcqRev.is_correct).toBe(true);

    const multiRev = submitRes.body.review.find((r: any) => r.question_id === multiQuestionId);
    expect(multiRev.is_correct).toBe(true);

    const shortRev = submitRes.body.review.find((r: any) => r.question_id === shortQuestionId);
    expect(shortRev.is_correct).toBe(true);
  });
});
