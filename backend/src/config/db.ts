import { Pool } from 'pg';
import Redis from 'ioredis';
import { config } from './index';

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  retryStrategy: (times) => {
    return Math.min(times * 100, 3000);
  },
});

redis.on('error', (err) => {
  console.warn('Redis connection warning:', err.message);
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}
