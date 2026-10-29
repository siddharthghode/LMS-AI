import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../../config/db';
import { config } from '../../config';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  role: z.enum(['student', 'instructor', 'admin']).optional().default('student'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

// Helper to generate tokens
function generateTokens(user: { id: string; email: string; role: string; fullName: string }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    config.jwtSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    config.jwtRefreshSecret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// POST /auth/register
authRouter.post('/register', authRateLimiter, async (req: Request, res: Response, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check existing email
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      res.status(409).json({
        error: {
          code: 'USER_ALREADY_EXISTS',
          message: 'An account with this email address already exists.',
          field: 'email',
        },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        `INSERT INTO users (full_name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, full_name, email, is_active, created_at`,
        [data.full_name, data.email, passwordHash]
      );
      const user = userRes.rows[0];

      // Assign Role
      const roleRes = await client.query('SELECT id FROM roles WHERE name = $1', [data.role]);
      const roleId = roleRes.rows.length > 0 ? roleRes.rows[0].id : 1;

      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user.id, roleId]
      );

      // Create initial streak
      await client.query(
        'INSERT INTO streaks (user_id, current_streak, longest_streak, last_active_date) VALUES ($1, 1, 1, CURRENT_DATE) ON CONFLICT DO NOTHING',
        [user.id]
      );

      await client.query('COMMIT');

      const tokens = generateTokens({
        id: user.id,
        email: user.email,
        role: data.role,
        fullName: user.full_name,
      });

      res.status(201).json({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: data.role,
          streak: {
            current: 1,
            longest: 1,
          },
          badges: [],
        },
      });
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

// POST /auth/login
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const userRes = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.password_hash, u.avatar_url, u.is_active,
              COALESCE(r.name, 'student') as role
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.email = $1`,
      [data.email]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
      return;
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'This account has been deactivated or suspended.',
        },
      });
      return;
    }

    const isMatch = await bcrypt.compare(data.password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
      return;
    }

    // Update streak for active student
    await pool.query(
      `INSERT INTO streaks (user_id, current_streak, longest_streak, last_active_date)
       VALUES ($1, 1, 1, CURRENT_DATE)
       ON CONFLICT (user_id) DO UPDATE SET
         current_streak = CASE
           WHEN streaks.last_active_date = CURRENT_DATE THEN streaks.current_streak
           WHEN streaks.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN streaks.current_streak + 1
           ELSE 1
         END,
         longest_streak = GREATEST(streaks.longest_streak, CASE
           WHEN streaks.last_active_date = CURRENT_DATE THEN streaks.current_streak
           WHEN streaks.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN streaks.current_streak + 1
           ELSE 1
         END),
         last_active_date = CURRENT_DATE`,
      [user.id]
    );

    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
    });

    const streakRes = await pool.query(
      `SELECT current_streak, longest_streak FROM streaks WHERE user_id = $1`,
      [user.id]
    );
    const streak = streakRes.rows[0] || { current_streak: 1, longest_streak: 1 };

    const badgesRes = await pool.query(
      `SELECT b.id, b.name, b.description, b.icon_url, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [user.id]
    );

    res.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        streak: {
          current: streak.current_streak,
          longest: streak.longest_streak,
        },
        badges: badgesRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response, next) => {
  try {
    const data = refreshSchema.parse(req.body);
    const payload = jwt.verify(data.refresh_token, config.jwtRefreshSecret) as {
      id: string;
      email: string;
      role: string;
      fullName: string;
    };

    const userRes = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.is_active, COALESCE(r.name, 'student') as role
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id = $1`,
      [payload.id]
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'User no longer active',
        },
      });
      return;
    }

    const u = userRes.rows[0];
    const tokens = generateTokens({
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.full_name,
    });

    res.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  } catch {
    res.status(401).json({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      },
    });
  }
});

// POST /auth/logout
authRouter.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  // In a stateless JWT architecture with refresh tokens, client discards tokens
  res.json({ message: 'Successfully logged out' });
});

// GET /auth/me
authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userRes = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.created_at,
              COALESCE(r.name, 'student') as role,
              COALESCE(s.current_streak, 0) as current_streak,
              COALESCE(s.longest_streak, 0) as longest_streak
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       LEFT JOIN streaks s ON u.id = s.user_id
       WHERE u.id = $1`,
      [req.user!.id]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    const user = userRes.rows[0];

    // Fetch user badges
    const badgesRes = await pool.query(
      `SELECT b.id, b.name, b.description, b.icon_url, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [req.user!.id]
    );

    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        streak: {
          current: user.current_streak,
          longest: user.longest_streak,
        },
        badges: badgesRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});
