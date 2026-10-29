import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/db';

export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    if (redis.status !== 'ready') return null;
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err: any) {
    console.warn(`[Redis Cache] Get failed for key "${key}":`, err.message);
    return null;
  }
}

export async function setCache(key: string, data: any, ttlSeconds: number): Promise<void> {
  try {
    if (redis.status !== 'ready') return;
    await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch (err: any) {
    console.warn(`[Redis Cache] Set failed for key "${key}":`, err.message);
  }
}

export async function invalidateCachePattern(pattern: string): Promise<number> {
  try {
    if (redis.status !== 'ready') return 0;
    const keys = await redis.keys(pattern);
    if (keys && keys.length > 0) {
      await redis.del(...keys);
      console.log(`[Redis Cache] Invalidation removed ${keys.length} key(s) matching "${pattern}"`);
      return keys.length;
    }
    return 0;
  } catch (err: any) {
    console.warn(`[Redis Cache] Invalidation failed for pattern "${pattern}":`, err.message);
    return 0;
  }
}

export function cacheMiddleware(ttlSeconds: number, keyPrefix: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const queryString = Object.keys(req.query).length > 0 ? `:${JSON.stringify(req.query)}` : '';
    const cacheKey = `${keyPrefix}:${req.baseUrl || ''}${req.path}${queryString}`;

    try {
      const cached = await getCache(cacheKey);
      if (cached !== null) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        res.json(cached);
        return;
      }
    } catch (err: any) {
      console.warn('[Redis Cache] Cache lookup error, falling back to database:', err.message);
    }

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Cache-Key', cacheKey);

    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCache(cacheKey, body, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}
