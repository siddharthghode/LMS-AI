import request from 'supertest';
import { app } from '../src/server';
import { pool } from '../src/config/db';
import { invalidateCachePattern } from '../src/utils/cache';

describe('Admin Governance, User Management & Moderation Tests (FR-AD1 to FR-AD5)', () => {
  let adminToken = '';
  let instructorToken = '';
  let studentToken = '';
  let adminUserId = '';

  beforeAll(async () => {
    await invalidateCachePattern('cache:courses:*');

    // 1. Login as Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@lms.local', password: 'Password123!' });
    adminToken = adminRes.body.access_token;
    adminUserId = adminRes.body.user.id;

    // 2. Login as Instructor
    const instructorRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'instructor@lms.local', password: 'Password123!' });
    instructorToken = instructorRes.body.access_token;

    // 3. Login as Student
    const studentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@lms.local', password: 'Password123!' });
    studentToken = studentRes.body.access_token;
  });

  describe('FR-AD1: Course Approval Lifecycle', () => {
    let pendingCourseId = '';

    it('Instructor creates a course -> Status defaults to pending', async () => {
      const res = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'Quantum Computing for AI Engineers',
          description: 'Introduction to qubits, quantum gates, and hybrid quantum neural networks.',
          category: 'Artificial Intelligence',
          difficulty: 'advanced',
          pricing_tier: 'tier_4',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
      pendingCourseId = res.body.id;
    });

    it('Pending course appears in admin pending queue', async () => {
      const res = await request(app)
        .get('/api/v1/admin/courses/pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((c: any) => c.id === pendingCourseId);
      expect(found).toBeDefined();
      expect(found.title).toBe('Quantum Computing for AI Engineers');
    });

    it('Admin can approve pending course -> Status becomes approved', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/courses/${pendingCourseId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'approved',
          comment: 'Outstanding syllabus and rigorous instructional depth. Approved for public catalog.',
        });

      expect(res.status).toBe(200);
      expect(res.body.course.status).toBe('approved');
    });

    it('Admin can reject course with structured feedback', async () => {
      // Create a course to reject
      const createRes = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'Incomplete Draft Course',
          description: 'Placeholder description.',
          category: 'Web Development',
        });

      const courseToRejectId = createRes.body.id;

      const rejectRes = await request(app)
        .post(`/api/v1/admin/courses/${courseToRejectId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'rejected',
          comment: 'Please add at least 3 detailed module outlines and video transcripts.',
        });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.course.status).toBe('rejected');
    });
  });

  describe('FR-AD2: User Account Governance (View, Suspend, Delete)', () => {
    let testUserId = '';

    beforeAll(async () => {
      // Create a temporary test user for suspension and deletion tests
      const email = `test-user-${Date.now()}@lms.local`;
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          full_name: 'Test Deletable User',
          email,
          password: 'Password123!',
          role: 'student',
        });
      testUserId = regRes.body.user.id;
    });

    it('GET /api/v1/admin/users - Admin can view and search user accounts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?q=Test+Deletable')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].full_name).toContain('Test Deletable');
    });

    it('PUT /api/v1/admin/users/:id/suspend - Admin can suspend user account', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${testUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.is_active).toBe(false);
    });

    it('PUT /api/v1/admin/users/:id/suspend - Admin can reactivate suspended account', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${testUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: true });

      expect(res.status).toBe(200);
      expect(res.body.is_active).toBe(true);
    });

    it('PUT /api/v1/admin/users/:id/suspend - Admin cannot suspend own account', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${adminUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_SUSPENSION_PROHIBITED');
    });

    it('DELETE /api/v1/admin/users/:id - Admin can permanently delete user account', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted successfully');

      // Verify user no longer exists in DB
      const checkRes = await request(app)
        .get(`/api/v1/admin/users?q=Test+Deletable`)
        .set('Authorization', `Bearer ${adminToken}`);
      const found = checkRes.body.find((u: any) => u.id === testUserId);
      expect(found).toBeUndefined();
    });

    it('DELETE /api/v1/admin/users/:id - Admin cannot delete own account', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_DELETION_PROHIBITED');
    });
  });

  describe('FR-AD3: Platform-wide Metrics Dashboard (DAU, enrollments, completion rate, revenue)', () => {
    it('GET /api/v1/admin/analytics/overview - Returns platform-wide vital metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('metrics');

      const { metrics } = res.body;

      // 1. DAU (Daily Active Users)
      expect(metrics).toHaveProperty('dau');
      expect(typeof metrics.dau).toBe('number');
      expect(metrics.dau).toBeGreaterThanOrEqual(1);

      // 2. Enrollments
      expect(metrics).toHaveProperty('enrollments');
      expect(typeof metrics.enrollments).toBe('number');
      expect(metrics.enrollments).toBeGreaterThanOrEqual(1);

      // 3. Completion Rate
      expect(metrics).toHaveProperty('completion_rate');
      expect(typeof metrics.completion_rate).toBe('number');
      expect(metrics.completion_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.completion_rate).toBeLessThanOrEqual(100);

      // 4. Revenue
      expect(metrics).toHaveProperty('revenue');
      expect(typeof metrics.revenue).toBe('number');
      expect(metrics.revenue).toBeGreaterThanOrEqual(0);

      // Secondary metrics
      expect(metrics).toHaveProperty('total_users');
      expect(metrics).toHaveProperty('total_courses');
    });
  });

  describe('FR-AD4: Role Assignment & Revocation (student/instructor/admin)', () => {
    let testUserId = '';

    beforeAll(async () => {
      // Create user to test role mutations
      const email = `role-test-${Date.now()}@lms.local`;
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          full_name: 'Role Test User',
          email,
          password: 'Password123!',
          role: 'student',
        });
      testUserId = regRes.body.user.id;
    });

    it('Admin can assign instructor role to student', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${testUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'instructor' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('instructor');
    });

    it('Admin can revoke instructor role back to student', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${testUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'student' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('student');
    });

    it('Admin can assign admin role to user', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${testUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('admin');
    });

    it('Admin cannot revoke their own admin role', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${adminUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'student' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_DEMOTION_PROHIBITED');
    });

    it('Non-admin cannot update roles', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${testUserId}/role`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
    });
  });

  describe('FR-AD5: Community Forum & Discussion Moderation', () => {
    let courseId = '';
    let threadId = '';
    let postId = '';

    beforeAll(async () => {
      // Find an approved course
      const courseRes = await pool.query(`SELECT id FROM courses WHERE status = 'approved' LIMIT 1`);
      courseId = courseRes.rows[0].id;

      // Create a discussion thread
      const threadRes = await request(app)
        .post(`/api/v1/discussions/${courseId}/discussions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Question regarding optimization techniques',
          content: 'Here is an initial thread question.',
        });
      threadId = threadRes.body.id;

      // Add a comment / post that will be flagged
      const postRes = await request(app)
        .post(`/api/v1/discussions/${threadId}/posts`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          content: 'Spam promotional content violating community guidelines http://spam-site.com',
        });
      postId = postRes.body.id;
    });

    it('Learner/Instructor can flag an inappropriate post', async () => {
      const flagRes = await request(app)
        .put(`/api/v1/discussions/posts/${postId}/flag`)
        .set('Authorization', `Bearer ${instructorToken}`);

      expect(flagRes.status).toBe(200);
      expect(flagRes.body.message).toContain('flagged');
    });

    it('Admin can view flagged posts in moderation queue', async () => {
      const res = await request(app)
        .get('/api/v1/admin/moderation/flagged-posts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((p: any) => p.id === postId);
      expect(found).toBeDefined();
      expect(found.content).toContain('Spam promotional content');
    });

    it('Admin can dismiss flag (approves post without deleting)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/moderation/posts/${postId}/dismiss`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('dismissed');

      // Verify it is no longer in flagged queue
      const queueRes = await request(app)
        .get('/api/v1/admin/moderation/flagged-posts')
        .set('Authorization', `Bearer ${adminToken}`);
      const found = queueRes.body.find((p: any) => p.id === postId);
      expect(found).toBeUndefined();
    });

    it('Admin can permanently delete offending flagged post', async () => {
      // Create another flagged post to delete
      const newPostRes = await request(app)
        .post(`/api/v1/discussions/${threadId}/posts`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          content: 'Harmful abusive language that must be removed completely.',
        });
      const deletePostId = newPostRes.body.id;

      // Flag it
      await request(app)
        .put(`/api/v1/discussions/posts/${deletePostId}/flag`)
        .set('Authorization', `Bearer ${studentToken}`);

      // Admin deletes post
      const delRes = await request(app)
        .delete(`/api/v1/admin/moderation/posts/${deletePostId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.message).toContain('removed successfully');

      // Verify post is gone from DB
      const postCheck = await pool.query('SELECT id FROM discussion_posts WHERE id = $1', [deletePostId]);
      expect(postCheck.rows.length).toBe(0);
    });
  });
});
