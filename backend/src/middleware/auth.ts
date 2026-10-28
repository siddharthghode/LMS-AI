import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../config/db';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  fullName: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header with Bearer token',
      },
    });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      id: string;
      email: string;
      role: string;
      fullName: string;
    };

    // Verify user is still active in database
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.is_active, r.name as role
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
          message: 'Account is inactive or suspended',
        },
      });
      return;
    }

    req.user = {
      id: userRes.rows[0].id,
      email: userRes.rows[0].email,
      fullName: userRes.rows[0].full_name,
      role: userRes.rows[0].role || 'student',
    };

    next();
  } catch (err: any) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token has expired or is invalid',
      },
    });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Action requires one of the following roles: ${allowedRoles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}
