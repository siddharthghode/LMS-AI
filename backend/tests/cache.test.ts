import request from 'supertest';
import { app } from '../src/server';
import { setCache, getCache, invalidateCachePattern } from '../src/utils/cache';
import { redis } from '../src/config/db';

describe('Redis Caching & Invalidation Integration Tests', () => {
  beforeAll(async () => {
    if (redis.status !== 'ready') {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), 1500);
        redis.once('ready', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  });

  it('setCache & getCache - Should store and retrieve JSON objects with TTL', async () => {
    const testKey = 'test:cache:item:1';
    const payload = { id: 1, name: 'LMS AI Cache Test', timestamp: Date.now() };

    await setCache(testKey, payload, 60);
    const retrieved = await getCache(testKey);

    expect(retrieved).toEqual(payload);
  });

  it('invalidateCachePattern - Should delete all matching keys', async () => {
    await setCache('test:pattern:a', { val: 'a' }, 60);
    await setCache('test:pattern:b', { val: 'b' }, 60);

    const deletedCount = await invalidateCachePattern('test:pattern:*');
    expect(deletedCount).toBeGreaterThanOrEqual(2);

    const checkA = await getCache('test:pattern:a');
    expect(checkA).toBeNull();
  });

  it('GET /api/v1/courses - Should attach X-Cache HIT on repeated calls', async () => {
    // 1st request -> (MISS or HIT)
    await request(app).get('/api/v1/courses');

    // 2nd request -> HIT
    const res = await request(app).get('/api/v1/courses');
    expect(res.headers['x-cache']).toBe('HIT');
    expect(res.status).toBe(200);
  });
});
