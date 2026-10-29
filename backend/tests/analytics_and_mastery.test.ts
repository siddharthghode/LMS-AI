import request from 'supertest';
import { app } from '../src/server';
import { pool } from '../src/config/db';

describe('Course Analytics (FR-I5) & Topic Mastery (FR-A8) Integration Tests', () => {
  let studentToken = '';
  let instructorToken = '';
  let sampleCourseId = '';

  beforeAll(async () => {
    // 1. Login as student & instructor
    const studentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@lms.local', password: 'Password123!' });
    studentToken = studentRes.body.access_token;

    const instructorRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'instructor@lms.local', password: 'Password123!' });
    instructorToken = instructorRes.body.access_token;

    // 2. Fetch a course id from DB
    const cRes = await pool.query('SELECT id FROM courses LIMIT 1');
    if (cRes.rows.length > 0) {
      sampleCourseId = cRes.rows[0].id;
    }
  });

  describe('Topic Mastery Tracking & Adaptive AI (FR-A8)', () => {
    it('GET /api/v1/gamification/mastery/me - Should return per-topic mastery scores and recommended mode', async () => {
      const res = await request(app)
        .get('/api/v1/gamification/mastery/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user_id');
      expect(res.body).toHaveProperty('topics');
      expect(Array.isArray(res.body.topics)).toBe(true);
      expect(res.body).toHaveProperty('overall_mastery');
      expect(res.body).toHaveProperty('recommended_mode');
      expect(['beginner', 'intermediate', 'advanced']).toContain(res.body.recommended_mode);

      if (res.body.topics.length > 0) {
        const first = res.body.topics[0];
        expect(first).toHaveProperty('topic');
        expect(first).toHaveProperty('mastery_score');
      }
    });

    it('GET /api/v1/ai/mastery/me - Should return adaptive AI tutor mastery context', async () => {
      const res = await request(app)
        .get('/api/v1/ai/mastery/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('topics');
      expect(res.body).toHaveProperty('recommended_mode');
    });
  });

  describe('Course Analytics & Retention Funnel (FR-I5)', () => {
    it('GET /api/v1/courses/:id/analytics - Should return retention funnel, time on task, and quiz averages', async () => {
      // Find course owned by instructor or check as admin
      const adminRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@lms.local', password: 'Password123!' });
      const adminToken = adminRes.body.access_token;

      const res = await request(app)
        .get(`/api/v1/courses/${sampleCourseId}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('course');
      expect(res.body.course).toHaveProperty('id', sampleCourseId);
      expect(res.body).toHaveProperty('metrics');
      expect(res.body.metrics).toHaveProperty('total_enrolled');
      expect(res.body.metrics).toHaveProperty('completion_rate');
      expect(res.body.metrics).toHaveProperty('quiz_performance');
      expect(res.body.metrics).toHaveProperty('time_on_task');
      expect(res.body.metrics.time_on_task).toHaveProperty('total_seconds');
      expect(res.body.metrics.time_on_task).toHaveProperty('total_minutes');
      expect(res.body.metrics.time_on_task).toHaveProperty('total_hours');
      expect(res.body).toHaveProperty('lecture_drop_off');
      expect(Array.isArray(res.body.lecture_drop_off)).toBe(true);

      if (res.body.lecture_drop_off.length > 0) {
        const item = res.body.lecture_drop_off[0];
        expect(item).toHaveProperty('lecture_id');
        expect(item).toHaveProperty('lecture_title');
        expect(item).toHaveProperty('students_completed');
        expect(item).toHaveProperty('retention_rate');
        expect(item).toHaveProperty('drop_off_rate');
      }
    });
  });
});
