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
             c.price, c.status, c.created_at,
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

// POST /courses - Create course (instructor / admin)
const createCourseSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('beginner'),
  thumbnail_url: z.string().optional(),
  price: z.number().optional().default(0),
  rating: z.number().optional().default(4.8),
});

coursesRouter.post('/', authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const data = createCourseSchema.parse(req.body);

    // Default status: instructor creates -> pending; admin creates -> approved
    const status = req.user!.role === 'admin' ? 'approved' : 'pending';

    const insertRes = await pool.query(
      `INSERT INTO courses (instructor_id, title, description, category, difficulty, thumbnail_url, price, status, rating, ratings_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user!.id,
        data.title,
        data.description || '',
        data.category || 'General',
        data.difficulty,
        data.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
        data.price,
        status,
        data.rating,
        0,
      ]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
       VALUES ($1, 'COURSE_CREATED', 'course', $2, $3)`,
      [req.user!.id, insertRes.rows[0].id, JSON.stringify({ title: data.title, status })]
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
    const { title, description, category, difficulty, thumbnail_url, price, status } = req.body;

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
           status = COALESCE($7, status)
       WHERE id = $8
       RETURNING *`,
      [title, description, category, difficulty, thumbnail_url, price, req.user!.role === 'admin' ? status : undefined, id]
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
coursesRouter.post('/modules/:id/lectures', authenticateToken, requireRole('instructor', 'admin'), async (req: AuthenticatedRequest, res: Response, next) => {
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
