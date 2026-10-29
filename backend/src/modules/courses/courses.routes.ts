import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../config/db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { triggerLectureIngestion } from '../ai/ai.service';
import { cacheMiddleware, invalidateCachePattern } from '../../utils/cache';
import { ingestionQueue } from '../../jobs/queues';

export const coursesRouter = Router();

// GET /courses - Public catalog (Cached TTL 5 min)
coursesRouter.get('/', cacheMiddleware(300, 'cache:courses:list'), async (req: Request, res: Response, next) => {
  try {
    const { category, difficulty, rating, min_rating, q, page = '1', limit = '12', status } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    // Filter by status (default to approved for public, unless requested or instructor/admin)
    if (status) {
      conditions.push(`c.status = $${idx++}`);
      params.push(status);
    } else {
      conditions.push(`c.status = 'approved'`);
    }

    if (category && category !== 'All') {
      conditions.push(`c.category ILIKE $${idx++}`);
      params.push(`%${category}%`);
    }

    if (difficulty && difficulty !== 'All') {
      conditions.push(`c.difficulty = $${idx++}`);
      params.push(difficulty);
    }

    const targetRating = rating || min_rating;
    if (targetRating && targetRating !== 'All') {
      const parsedRating = parseFloat(targetRating as string);
      if (!isNaN(parsedRating)) {
        conditions.push(`c.rating >= $${idx++}`);
        params.push(parsedRating);
      }
    }

    if (q && (q as string).trim()) {
      conditions.push(`(c.title ILIKE $${idx} OR c.description ILIKE $${idx} OR c.category ILIKE $${idx})`);
      params.push(`%${(q as string).trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM courses c ${whereClause}`;
    const totalCountRes = await pool.query(countQuery, params);
    const total = parseInt(totalCountRes.rows[0].count, 10);

    const listQuery = `
      SELECT c.id, c.title, c.description, c.category, c.difficulty, c.thumbnail_url,
             c.price, COALESCE(c.pricing_tier, 'free') as pricing_tier, c.status, c.created_at,
             COALESCE(c.rating, 4.8)::float as rating,
             COALESCE(c.ratings_count, 0) as ratings_count,
             u.id as instructor_id, u.full_name as instructor_name, u.avatar_url as instructor_avatar,
             (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as modules_count,
             (SELECT COUNT(*) FROM lectures l JOIN modules m ON l.module_id = m.id WHERE m.course_id = c.id) as lectures_count,
             (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as students_enrolled
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const coursesRes = await pool.query(listQuery, [...params, limitNum, offset]);

    res.json({
      data: coursesRes.rows,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /courses/categories - Distinct categories of approved courses
coursesRouter.get('/categories', async (req: Request, res: Response, next) => {
  try {
    const catsRes = await pool.query(
      `SELECT DISTINCT category FROM courses WHERE status = 'approved' AND category IS NOT NULL AND TRIM(category) != '' ORDER BY category ASC`
    );
    res.json(catsRes.rows.map(r => r.category));
  } catch (err) {
    next(err);
  }
});

// GET /courses/:id - Course detail with modules and lectures (Cached TTL 5 min)
coursesRouter.get('/:id', cacheMiddleware(300, 'cache:courses:detail'), async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const courseRes = await pool.query(
      `SELECT c.*,
              u.id as instructor_id, u.full_name as instructor_name, u.avatar_url as instructor_avatar,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as students_enrolled
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (courseRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Course not found' } });
      return;
    }

    const course = courseRes.rows[0];

    // Fetch modules
    const modulesRes = await pool.query(
      `SELECT * FROM modules WHERE course_id = $1 ORDER BY order_index ASC`,
      [id]
    );

    // Fetch lectures for all modules
    const lecturesRes = await pool.query(
      `SELECT l.* FROM lectures l
       JOIN modules m ON l.module_id = m.id
       WHERE m.course_id = $1
       ORDER BY l.order_index ASC`,
      [id]
    );

    // Group lectures into modules
    const modulesWithLectures = modulesRes.rows.map(mod => ({
      ...mod,
      lectures: lecturesRes.rows.filter(lec => lec.module_id === mod.id),
    }));

    res.json({
      ...course,
      modules: modulesWithLectures,
    });
  } catch (err) {
    next(err);
  }
});

const TIER_PRICE_MAP: Record<string, number> = {
  free: 0,
  tier_1: 19.99,
  tier_2: 49.99,
  tier_3: 79.99,
  tier_4: 99.99,
};

// POST /courses - Create course (instructor / admin)
const createCourseSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('beginner'),
  thumbnail_url: z.string().optional(),
  pricing_tier: z.string().optional(),
  price: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional(),
  rating: z.number().optional().default(4.8),
});

coursesRouter.post('/', authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const data = createCourseSchema.parse(req.body);

    let pricingTier = data.pricing_tier;
    let finalPrice = typeof data.price === 'number' ? data.price : (data.price !== undefined ? parseFloat(data.price as any) : undefined);

    if (!pricingTier) {
      if (finalPrice !== undefined && finalPrice > 0) {
        if (finalPrice === 19.99) pricingTier = 'tier_1';
        else if (finalPrice === 49.99) pricingTier = 'tier_2';
        else if (finalPrice === 79.99) pricingTier = 'tier_3';
        else if (finalPrice === 99.99) pricingTier = 'tier_4';
        else pricingTier = 'custom';
      } else {
        pricingTier = 'free';
      }
    }

    if (finalPrice === undefined) {
      finalPrice = TIER_PRICE_MAP[pricingTier] !== undefined ? TIER_PRICE_MAP[pricingTier] : 0;
    }

    // Default status: instructor creates -> pending; admin creates -> approved
    const status = req.user!.role === 'admin' ? 'approved' : 'pending';

    const insertRes = await pool.query(
      `INSERT INTO courses (instructor_id, title, description, category, difficulty, thumbnail_url, price, pricing_tier, status, rating, ratings_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.user!.id,
        data.title,
        data.description || '',
        data.category || 'General',
        data.difficulty,
        data.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
        finalPrice,
        pricingTier,
        status,
        data.rating,
        0,
      ]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
       VALUES ($1, 'COURSE_CREATED', 'course', $2, $3)`,
      [req.user!.id, insertRes.rows[0].id, JSON.stringify({ title: data.title, status, pricing_tier: pricingTier, price: finalPrice })]
    );

    // Invalidate course cache
    await invalidateCachePattern('cache:courses:*');

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /courses/:id - Update course metadata
coursesRouter.put('/:id', authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { title, description, category, difficulty, thumbnail_url, price, pricing_tier, status } = req.body;

    // Verify ownership if not admin
    if (req.user!.role !== 'admin') {
      const ownerCheck = await pool.query('SELECT instructor_id FROM courses WHERE id = $1', [id]);
      if (ownerCheck.rows.length === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Course not found' } });
        return;
      }
      if (ownerCheck.rows[0].instructor_id !== req.user!.id) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the course instructor or an admin can edit this course' } });
        return;
      }
    }

    const updateRes = await pool.query(
      `UPDATE courses
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           difficulty = COALESCE($4, difficulty),
           thumbnail_url = COALESCE($5, thumbnail_url),
           price = COALESCE($6, price),
           pricing_tier = COALESCE($7, pricing_tier),
           status = COALESCE($8, status)
       WHERE id = $9
       RETURNING *`,
      [title, description, category, difficulty, thumbnail_url, price, pricing_tier, req.user!.role === 'admin' ? status : undefined, id]
    );

    await invalidateCachePattern('cache:courses:*');
    res.json(updateRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /courses/:id/modules - Add module
coursesRouter.post('/:id/modules', authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: courseId } = req.params;
    const { title, order_index } = req.body;

    const countRes = await pool.query('SELECT COUNT(*) FROM modules WHERE course_id = $1', [courseId]);
    const nextOrder = order_index ?? parseInt(countRes.rows[0].count, 10) + 1;

    const insertRes = await pool.query(
      `INSERT INTO modules (course_id, title, order_index)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [courseId, title || 'New Module', nextOrder]
    );

    // Invalidate course cache
    await invalidateCachePattern('cache:courses:*');

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /modules/:id/lectures - Add lecture
coursesRouter.post(['/modules/:id/lectures', '/courses/modules/:id/lectures'], authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: moduleId } = req.params;
    const { title, video_url, transcript, duration_seconds, order_index, resource_urls } = req.body;

    // Check module and course
    const modRes = await pool.query('SELECT course_id FROM modules WHERE id = $1', [moduleId]);
    if (modRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Module not found' } });
      return;
    }
    const courseId = modRes.rows[0].course_id;

    const countRes = await pool.query('SELECT COUNT(*) FROM lectures WHERE module_id = $1', [moduleId]);
    const nextOrder = order_index ?? parseInt(countRes.rows[0].count, 10) + 1;

    const insertRes = await pool.query(
      `INSERT INTO lectures (module_id, title, video_url, transcript, duration_seconds, order_index, resource_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        moduleId,
        title || 'New Lecture',
        video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        transcript || '',
        duration_seconds || 300,
        nextOrder,
        resource_urls || [],
      ]
    );

    const lecture = insertRes.rows[0];

    // Enqueue asynchronous background ingestion & chunking with BullMQ
    if (transcript && transcript.trim().length > 0) {
      ingestionQueue.add('ingest-lecture', {
        courseId,
        lectureId: lecture.id,
        transcript,
      }).catch(err => {
        console.warn('BullMQ ingestion queue addition warning:', err.message);
      });
    }

    await invalidateCachePattern('cache:courses:*');
    res.status(201).json(lecture);
  } catch (err) {
    next(err);
  }
});

// PUT /lectures/:id - Update lecture metadata & resources
coursesRouter.put('/lectures/:id', authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { title, video_url, transcript, duration_seconds, resource_urls } = req.body;

    const updateRes = await pool.query(
      `UPDATE lectures
       SET title = COALESCE($1, title),
           video_url = COALESCE($2, video_url),
           transcript = COALESCE($3, transcript),
           duration_seconds = COALESCE($4, duration_seconds),
           resource_urls = COALESCE($5, resource_urls)
       WHERE id = $6
       RETURNING *`,
      [title, video_url, transcript, duration_seconds, resource_urls, id]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lecture not found' } });
      return;
    }

    await invalidateCachePattern('cache:courses:*');
    res.json(updateRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /courses/:id/analytics - Instructor Analytics (FR-I5: drop-off, avg quiz score, time-on-task)
coursesRouter.get('/:id/analytics', authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Check course existence & ownership
    const courseCheck = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (courseCheck.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Course not found' } });
      return;
    }
    const course = courseCheck.rows[0];

    if (req.user!.role !== 'admin' && course.instructor_id !== req.user!.id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to analytics for this course' } });
      return;
    }

    // 1. Enrollment stats
    const enrollRes = await pool.query(
      `SELECT COUNT(*) as total_enrolled,
              COUNT(CASE WHEN progress_percent >= 100 THEN 1 END) as total_completed,
              COALESCE(ROUND(AVG(progress_percent), 1), 0) as avg_progress
       FROM enrollments WHERE course_id = $1`,
      [id]
    );
    const totalEnrolled = parseInt(enrollRes.rows[0].total_enrolled, 10);
    const totalCompleted = parseInt(enrollRes.rows[0].total_completed, 10);
    const avgProgress = parseFloat(enrollRes.rows[0].avg_progress);
    const completionRate = totalEnrolled > 0 ? parseFloat(((totalCompleted / totalEnrolled) * 100).toFixed(1)) : 0;

    // 2. Time-on-task
    const timeRes = await pool.query(
      `SELECT COALESCE(SUM(lp.watched_seconds), 0) as total_seconds
       FROM lecture_progress lp
       JOIN enrollments e ON lp.enrollment_id = e.id
       WHERE e.course_id = $1`,
      [id]
    );
    const totalSeconds = parseInt(timeRes.rows[0].total_seconds, 10);
    const totalHours = parseFloat((totalSeconds / 3600).toFixed(1));
    const totalMinutes = Math.round(totalSeconds / 60);
    const avgMinutesPerStudent = totalEnrolled > 0 ? Math.round(totalMinutes / totalEnrolled) : 0;

    // 3. Average Quiz Score
    const quizRes = await pool.query(
      `SELECT COALESCE(ROUND(AVG(qa.score), 1), 0) as avg_quiz_score,
              COUNT(qa.id) as attempts_count
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       JOIN modules m ON q.module_id = m.id
       WHERE m.course_id = $1 AND qa.submitted_at IS NOT NULL`,
      [id]
    );
    const avgQuizScore = parseFloat(quizRes.rows[0].avg_quiz_score);
    const totalQuizAttempts = parseInt(quizRes.rows[0].attempts_count, 10);

    // 4. Per-Lecture Drop-Off Retention Funnel
    const lecturesRes = await pool.query(
      `SELECT l.id as lecture_id, l.title as lecture_title, l.order_index as lecture_order,
              l.duration_seconds,
              m.id as module_id, m.title as module_title, m.order_index as module_order,
              (SELECT COUNT(DISTINCT e.user_id)
               FROM lecture_progress lp
               JOIN enrollments e ON lp.enrollment_id = e.id
               WHERE lp.lecture_id = l.id AND (lp.watched_seconds > 0 OR lp.completed = TRUE)
              ) as watched_count,
              (SELECT COUNT(DISTINCT e.user_id)
               FROM lecture_progress lp
               JOIN enrollments e ON lp.enrollment_id = e.id
               WHERE lp.lecture_id = l.id AND lp.completed = TRUE
              ) as completed_count
       FROM lectures l
       JOIN modules m ON l.module_id = m.id
       WHERE m.course_id = $1
       ORDER BY m.order_index ASC, l.order_index ASC`,
      [id]
    );

    const lectureDropOff = lecturesRes.rows.map((lec: any, idx: number) => {
      const watched = parseInt(lec.watched_count, 10);
      const completed = parseInt(lec.completed_count, 10);
      const retentionRate = totalEnrolled > 0 ? Math.round((watched / totalEnrolled) * 100) : (idx === 0 ? 100 : 80);
      const dropOffRate = 100 - retentionRate;

      return {
        lecture_id: lec.lecture_id,
        lecture_title: lec.lecture_title,
        module_title: lec.module_title,
        order_index: idx + 1,
        duration_seconds: lec.duration_seconds,
        students_watched: watched,
        students_completed: completed,
        retention_rate: retentionRate,
        drop_off_rate: Math.max(0, dropOffRate),
      };
    });

    res.json({
      course: {
        id: course.id,
        title: course.title,
        category: course.category,
        difficulty: course.difficulty,
        price: course.price,
      },
      metrics: {
        total_enrolled: totalEnrolled,
        total_completed: totalCompleted,
        completion_rate: completionRate,
        avg_progress: avgProgress,
        time_on_task: {
          total_seconds: totalSeconds,
          total_hours: totalHours,
          total_minutes: totalMinutes,
          avg_minutes_per_student: avgMinutesPerStudent,
        },
        quiz_performance: {
          avg_score: avgQuizScore,
          attempts_count: totalQuizAttempts,
        },
      },
      lecture_drop_off: lectureDropOff,
    });
  } catch (err) {
    next(err);
  }
});

// POST /courses/:id/approve - Admin approve/reject
coursesRouter.post('/:id/approve', authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { decision, comment } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(decision)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: "Decision must be 'approved' or 'rejected'" } });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const courseRes = await client.query(
        `UPDATE courses SET status = $1 WHERE id = $2 RETURNING *`,
        [decision, id]
      );

      if (courseRes.rows.length === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Course not found' } });
        await client.query('ROLLBACK');
        return;
      }

      await client.query(
        `INSERT INTO course_approvals (course_id, reviewed_by, decision, comment)
         VALUES ($1, $2, $3, $4)`,
        [id, req.user!.id, decision, comment || '']
      );

      // Notify instructor
      const instructorId = courseRes.rows[0].instructor_id;
      if (instructorId) {
        await client.query(
          `INSERT INTO notifications (user_id, title, body)
           VALUES ($1, $2, $3)`,
          [
            instructorId,
            `Course ${decision.toUpperCase()}: ${courseRes.rows[0].title}`,
            `Your course review was completed with status: ${decision}. Feedback: ${comment || 'No specific feedback provided.'}`,
          ]
        );
      }

      await client.query('COMMIT');
      await invalidateCachePattern('cache:courses:*');
      res.json({ message: `Course ${decision} successfully`, course: courseRes.rows[0] });
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
