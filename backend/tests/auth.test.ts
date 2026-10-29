import request from 'supertest';
import { app } from '../src/server';

describe('Authentication & Token API Tests', () => {
  const testEmail = `test_student_${Date.now()}@lms.local`;
  let refreshToken = '';
  let accessToken = '';

  it('POST /api/v1/auth/register - Should register a new student user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        full_name: 'Test Student',
        email: testEmail,
        password: 'Password123!',
        role: 'student',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.role).toBe('student');

    accessToken = res.body.access_token;
    refreshToken = res.body.refresh_token;
  });

  it('POST /api/v1/auth/register - Should reject duplicate email registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        full_name: 'Duplicate Student',
        email: testEmail,
        password: 'Password123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USER_ALREADY_EXISTS');
  });

  it('POST /api/v1/auth/login - Should login successfully with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'Password123!',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.body.user.email).toBe(testEmail);
  });

  it('POST /api/v1/auth/login - Should reject invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword999!',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/v1/auth/refresh - Should exchange refresh token for new access token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refresh_token: refreshToken,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(typeof res.body.access_token).toBe('string');
  });

  it('GET /api/v1/auth/me - Should return authenticated profile with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
  });
});
