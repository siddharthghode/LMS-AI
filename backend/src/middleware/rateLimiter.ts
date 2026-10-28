import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { redis } from '../config/db';

interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
}

const memoryStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(config: RateLimitConfig) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const identifier = req.user?.id || req.ip || req.socket.remoteAddress || 'unknown';
    const key = `ratelimit:${config.keyPrefix}:${identifier}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      if (redis.status === 'ready') {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, config.windowSeconds);
        }

        if (count > config.maxRequests) {
          res.status(429).json({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Too many requests. Limit is ${config.maxRequests} per ${config.windowSeconds} seconds.`,
            },
          });
          return;
        }
        next();
        return;
      }
    } catch {
      // Fallback to in-memory store if Redis encounters an issue
    }

    // In-memory fallback
    const entry = memoryStore.get(key);
    if (!entry || now > entry.resetTime) {
      memoryStore.set(key, { count: 1, resetTime: now + config.windowSeconds });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > config.maxRequests) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Limit is ${config.maxRequests} per ${config.windowSeconds} seconds.`,
        },
      });
      return;
    }

    next();
  };
}

export const authRateLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 30, // generous for dev/demo
  keyPrefix: 'auth',
});

export const aiRateLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 40,
  keyPrefix: 'ai',
});

export const generalRateLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 200,
  keyPrefix: 'general',
});
