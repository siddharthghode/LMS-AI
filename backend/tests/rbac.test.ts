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

  it('POST /api/v1/courses - Should support course creation with pricing tier (FR-I1)', async () => {
    const res = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({
        title: 'Complete Autonomous Agents Architecture',
        description: 'Master autonomous reasoning loops, memory systems, and tool execution pipelines.',
        category: 'Artificial Intelligence',
        difficulty: 'advanced',
        thumbnail_url: 'https://images.unsplash.com/photo-1677442136019-21780efad99a',
        pricing_tier: 'tier_2',
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Complete Autonomous Agents Architecture');
    expect(res.body.description).toContain('autonomous reasoning loops');
    expect(res.body.category).toBe('Artificial Intelligence');
    expect(res.body.thumbnail_url).toBe('https://images.unsplash.com/photo-1677442136019-21780efad99a');
    expect(res.body.pricing_tier).toBe('tier_2');
    expect(parseFloat(res.body.price)).toBe(49.99);
  });

  it('POST /api/v1/courses - Should support free and custom pricing tiers', async () => {
    // Free course
    const freeRes = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({
        title: 'Free Open-Source AI Fundamentals',
        description: 'Free introduction to generative AI models.',
        category: 'Artificial Intelligence',
        pricing_tier: 'free',
      });

    expect(freeRes.status).toBe(201);
    expect(freeRes.body.pricing_tier).toBe('free');
    expect(parseFloat(freeRes.body.price)).toBe(0);

    // Custom tier with price
    const customRes = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({
        title: 'Enterprise AI Strategy Consulting',
        description: 'Private coaching and enterprise system design.',
        category: 'Executive Education',
        pricing_tier: 'custom',
        price: 199.99,
      });

    expect(customRes.status).toBe(201);
    expect(customRes.body.pricing_tier).toBe('custom');
    expect(parseFloat(customRes.body.price)).toBe(199.99);
  });
});
