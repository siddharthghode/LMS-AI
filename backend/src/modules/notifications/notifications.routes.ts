import { Router, Response } from 'express';
import { pool } from '../../config/db';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth';

export const notificationsRouter = Router();

// GET /notifications/me
notificationsRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const notifs = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user!.id]
    );

    const unreadCount = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [req.user!.id]
    );

    res.json({
      notifications: notifs.rows,
      unread_count: parseInt(unreadCount.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
});

// PUT /notifications/:id/read
notificationsRouter.put('/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`, [id, req.user!.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
});

// PUT /notifications/read-all
notificationsRouter.put('/read-all', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await pool.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [req.user!.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});
