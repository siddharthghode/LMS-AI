import request from 'supertest';
import { app } from '../src/server';

describe('Course Catalog Filters & Student Dashboard Integration Tests', () => {
  let studentToken = '';

  beforeAll(async () => {
    const studentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@lms.local', password: 'Password123!' });
    studentToken = studentRes.body.access_token;
  });

  describe('Student Dashboard Endpoints', () => {
    it('GET /api/v1/enrollments/me - Should return enrolled courses with progress percent', async () => {
      const res = await request(app)
        .get('/api/v1/enrollments/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const enrollment = res.body[0];
      expect(enrollment).toHaveProperty('course_id');
      expect(enrollment).toHaveProperty('title');
      expect(enrollment).toHaveProperty('progress_percent');
      expect(enrollment).toHaveProperty('total_lectures');
      expect(enrollment).toHaveProperty('completed_lectures');
      expect(Number(enrollment.progress_percent)).toBeGreaterThanOrEqual(0);
      expect(Number(enrollment.progress_percent)).toBeLessThanOrEqual(100);
    });

    it('GET /api/v1/users/me/streak - Should return current and longest streak counter', async () => {
      const res = await request(app)
        .get('/api/v1/users/me/streak')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('current_streak');
      expect(res.body).toHaveProperty('longest_streak');
      expect(typeof res.body.current_streak).toBe('number');
      expect(typeof res.body.longest_streak).toBe('number');
      expect(res.body.current_streak).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/auth/login - Should include streak and badges in user response', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'student@lms.local', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('streak');
      expect(res.body.user.streak).toHaveProperty('current');
      expect(res.body.user.streak).toHaveProperty('longest');
    });
  });

  describe('Course Catalog Filters & Search', () => {
    it('GET /api/v1/courses/categories - Should return list of unique approved categories', async () => {
      const res = await request(app).get('/api/v1/courses/categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain('Artificial Intelligence');
      expect(res.body).toContain('DevOps & Cloud');
    });

    it('GET /api/v1/courses?category=... - Should filter courses by category', async () => {
      const res = await request(app).get('/api/v1/courses?category=Artificial+Intelligence');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const course of res.body.data) {
        expect(course.category.toLowerCase()).toContain('artificial intelligence');
      }
    });

    it('GET /api/v1/courses?difficulty=... - Should filter courses by difficulty', async () => {
      const res = await request(app).get('/api/v1/courses?difficulty=beginner');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const course of res.body.data) {
        expect(course.difficulty).toBe('beginner');
      }
    });

    it('GET /api/v1/courses?rating=... - Should filter courses with rating >= specified value', async () => {
      const minRating = 4.6;
      const res = await request(app).get(`/api/v1/courses?rating=${minRating}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const course of res.body.data) {
        expect(Number(course.rating)).toBeGreaterThanOrEqual(minRating);
      }
    });

    it('GET /api/v1/courses?q=... - Should search courses by title, keywords, or topics', async () => {
      const res = await request(app).get('/api/v1/courses?q=Kubernetes');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const matched = res.body.data.some((c: any) =>
        c.title.toLowerCase().includes('kubernetes') || c.description.toLowerCase().includes('kubernetes')
      );
      expect(matched).toBe(true);
    });

    it('GET /api/v1/courses?category=...&difficulty=...&rating=...&q=... - Should support combined filtering', async () => {
      const res = await request(app).get('/api/v1/courses?category=DevOps+%26+Cloud&difficulty=advanced&rating=4.5&q=Kubernetes');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const course = res.body.data[0];
      expect(course.category).toBe('DevOps & Cloud');
      expect(course.difficulty).toBe('advanced');
      expect(Number(course.rating)).toBeGreaterThanOrEqual(4.5);
      expect(course.title.toLowerCase()).toContain('kubernetes');
    });
  });
});
