import request from 'supertest';
import { app } from '../src/server';

describe('Role-Based Access Control (RBAC) Tests', () => {
  let studentToken = '';
  let adminToken = '';
  let instructorToken = '';

  beforeAll(async () => {
    // 1. Login as Student
    const studentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@lms.local', password: 'Password123!' });
    studentToken = studentRes.body.access_token;

    // 2. Login as Instructor
    const instructorRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'instructor@lms.local', password: 'Password123!' });
    instructorToken = instructorRes.body.access_token;

    // 3. Login as Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@lms.local', password: 'Password123!' });
    adminToken = adminRes.body.access_token;
  });

  it('GET /api/v1/admin/users - Should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/admin/users');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/admin/users - Should reject student with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('GET /api/v1/admin/users - Should reject instructor with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${instructorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('GET /api/v1/admin/users - Should allow admin with 200 OK', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/courses - Should reject course creation by student with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Unauthorized Course by Student',
        category: 'Hacking',
        difficulty: 'beginner',
        price: 0,
      });

    expect(res.status).toBe(403);
  });

  it('POST /api/v1/courses - Should allow course creation by instructor with 201 Created', async () => {
    const res = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({
        title: 'Instructor Test Course RBAC',
        description: 'Testing instructor privileges',
        category: 'Computer Science',
        difficulty: 'intermediate',
        price: 29.99,
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Instructor Test Course RBAC');
  });
});
