import { Router, Response } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth';

export const discussionsRouter = Router();

// GET /courses/:id/discussions - List threads
discussionsRouter.get(['/courses/:id/discussions', '/:id/discussions'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: courseId } = req.params;

    const threadsRes = await pool.query(
      `SELECT t.*, u.full_name as author_name, u.avatar_url as author_avatar,
              (SELECT COUNT(*) FROM discussion_posts p WHERE p.thread_id = t.id) as post_count,
              (SELECT MAX(p.created_at) FROM discussion_posts p WHERE p.thread_id = t.id) as last_activity
       FROM discussion_threads t
       JOIN users u ON t.created_by = u.id
       WHERE t.course_id = $1
       ORDER BY t.created_at DESC`,
      [courseId]
    );

    res.json(threadsRes.rows);
  } catch (err) {
    next(err);
  }
});

// POST /courses/:id/discussions - Create thread
discussionsRouter.post(['/courses/:id/discussions', '/:id/discussions'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: courseId } = req.params;
    const { title, content } = req.body;
    const userId = req.user!.id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const threadRes = await client.query(
        `INSERT INTO discussion_threads (course_id, created_by, title)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [courseId, userId, title]
      );
      const thread = threadRes.rows[0];

      if (content) {
        await client.query(
          `INSERT INTO discussion_posts (thread_id, user_id, content)
           VALUES ($1, $2, $3)`,
          [thread.id, userId, content]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(thread);
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

// GET /discussions/:id/posts - List posts for thread
discussionsRouter.get(['/discussions/:id/posts', '/:id/posts'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: threadId } = req.params;

    const postsRes = await pool.query(
      `SELECT p.*, u.full_name as author_name, u.avatar_url as author_avatar,
              COALESCE(r.name, 'student') as author_role
       FROM discussion_posts p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE p.thread_id = $1
       ORDER BY p.created_at ASC`,
      [threadId]
    );

    res.json(postsRes.rows);
  } catch (err) {
    next(err);
  }
});

// POST /discussions/:id/posts - Add reply post
discussionsRouter.post(['/discussions/:id/posts', '/:id/posts'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: threadId } = req.params;
    const { content } = req.body;

    const postRes = await pool.query(
      `INSERT INTO discussion_posts (thread_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [threadId, req.user!.id, content]
    );

    res.status(201).json(postRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /posts/:id/flag - Flag inappropriate post
discussionsRouter.put(['/posts/:id/flag', '/:id/flag'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE discussion_posts SET is_flagged = TRUE WHERE id = $1`, [id]);
    res.json({ message: 'Post flagged for moderation review' });
  } catch (err) {
    next(err);
  }
});

// PUT /posts/:id/unflag - Dismiss flag
discussionsRouter.put(['/posts/:id/unflag', '/:id/unflag', '/posts/:id/dismiss-flag', '/:id/dismiss-flag'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE discussion_posts SET is_flagged = FALSE WHERE id = $1`, [id]);
    res.json({ message: 'Flag dismissed successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /posts/:id - Delete post
discussionsRouter.delete(['/posts/:id', '/:id'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    if (['instructor', 'admin'].includes(role)) {
      await pool.query(`DELETE FROM discussion_posts WHERE id = $1`, [id]);
    } else {
      await pool.query(`DELETE FROM discussion_posts WHERE id = $1 AND user_id = $2`, [id, userId]);
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /courses/:id/announcements
discussionsRouter.get(['/courses/:id/announcements', '/:id/announcements'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: courseId } = req.params;

    const annRes = await pool.query(
      `SELECT a.*, u.full_name as author_name, u.avatar_url as author_avatar
       FROM announcements a
       JOIN users u ON a.posted_by = u.id
       WHERE a.course_id = $1
       ORDER BY a.created_at DESC`,
      [courseId]
    );

    res.json(annRes.rows);
  } catch (err) {
    next(err);
  }
});

// POST /courses/:id/announcements
discussionsRouter.post(['/courses/:id/announcements', '/:id/announcements'], authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: courseId } = req.params;
    const { content } = req.body;

    const annRes = await pool.query(
      `INSERT INTO announcements (course_id, posted_by, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [courseId, req.user!.id, content]
    );

    res.status(201).json(annRes.rows[0]);
  } catch (err) {
    next(err);
  }
});
