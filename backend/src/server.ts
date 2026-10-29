import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { pool, redis } from './config/db';
import { errorHandler } from './middleware/errorHandler';
import { generalRateLimiter } from './middleware/rateLimiter';

// Routers
import { authRouter } from './modules/auth/auth.routes';
import { coursesRouter } from './modules/courses/courses.routes';
import { enrollmentsRouter } from './modules/enrollments/enrollments.routes';
import { quizzesRouter } from './modules/quizzes/quizzes.routes';
import { assignmentsRouter } from './modules/assignments/assignments.routes';
import { gamificationRouter } from './modules/gamification/gamification.routes';
import { discussionsRouter } from './modules/discussions/discussions.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { aiRouter } from './modules/ai/ai.routes';
import { uploadsRouter } from './modules/uploads/uploads.routes';

const app = express();

// Security and utility middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Static files for uploaded materials
app.use('/uploads', express.static(config.uploadDir));

// Static documentation / OpenAPI spec
const docsDir = [
  path.resolve(__dirname, '../docs'),
  path.resolve(process.cwd(), 'docs'),
  path.resolve(__dirname, '../../docs'),
].find(d => fs.existsSync(path.resolve(d, 'api-spec.yaml'))) || path.resolve(process.cwd(), 'docs');

app.use('/docs', express.static(docsDir));
app.get(['/api-docs/spec', '/docs/api-spec.yaml'], (req, res) => {
  res.sendFile(path.resolve(docsDir, 'api-spec.yaml'));
});

import { initBackgroundWorkers, closeBackgroundWorkers, getQueueStats } from './jobs/worker';
import { initStreakScheduler } from './jobs/streakCron';

// Health check endpoint
app.get('/health', async (req, res) => {
  let dbStatus = 'healthy';
  let redisStatus = 'healthy';
  let queueStats: any = null;

  try {
    await pool.query('SELECT 1');
  } catch (err: any) {
    dbStatus = `unhealthy: ${err.message}`;
  }

  try {
    if (redis.status === 'ready' || redis.status === 'connecting') {
      await redis.ping();
      queueStats = await getQueueStats();
    } else {
      redisStatus = `status: ${redis.status}`;
    }
  } catch (err: any) {
    redisStatus = `unhealthy: ${err.message}`;
  }

  res.json({
    status: 'ok',
    service: 'lms-ai-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    redis: redisStatus,
    queues: queueStats,
  });
});

// General rate limiter for API routes
app.use('/api', generalRateLimiter);

// Mount API v1 Routers
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/courses', coursesRouter);
app.use('/api/v1/enrollments', enrollmentsRouter);
app.use('/api/v1/lectures', enrollmentsRouter);
app.use('/api/v1/notes', enrollmentsRouter);
app.use('/api/v1/bookmarks', enrollmentsRouter);
app.use('/api/v1/quizzes', quizzesRouter);
app.use('/api/v1/attempts', quizzesRouter);
app.use('/api/v1/assignments', assignmentsRouter);
app.use('/api/v1/submissions', assignmentsRouter);
app.use('/api/v1/gamification', gamificationRouter);
app.use('/api/v1/recommendations', gamificationRouter);
app.use('/api/v1/users', gamificationRouter);
app.use('/api/v1/leaderboard', gamificationRouter);
app.use('/api/v1/certificates', gamificationRouter);
app.use('/api/v1/courses', discussionsRouter);
app.use('/api/v1/discussions', discussionsRouter);
app.use('/api/v1/posts', discussionsRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/upload', uploadsRouter);

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.url} does not exist`,
    },
  });
});

import { runMigrations } from './db/migrate';
import { runSeed } from './db/seeders/seed';

// Centralized error handler
app.use(errorHandler);

let server: any;

async function startServer() {
  try {
    await runMigrations();
    try {
      const coursesRes = await pool.query('SELECT COUNT(*) FROM courses');
      if (parseInt(coursesRes.rows[0].count, 10) === 0) {
        console.log('Database empty, seeding default courses and accounts...');
        await runSeed();
      }
    } catch {
      // If table check fails, proceed
    }
  } catch (err: any) {
    console.warn('Database startup migration warning:', err.message);
  }

  server = app.listen(config.port, '0.0.0.0', async () => {
    console.log(`=========================================`);
    console.log(`LMS-AI Core Backend running on port ${config.port}`);
    console.log(`Health check: http://localhost:${config.port}/health`);
    console.log(`API Base: http://localhost:${config.port}/api/v1`);
    console.log(`Environment: ${config.env}`);
    console.log(`=========================================`);

    // Initialize BullMQ Workers & Streak Schedulers
    try {
      initBackgroundWorkers();
      await initStreakScheduler();
    } catch (workerErr: any) {
      console.warn('BullMQ initialization warning:', workerErr.message);
    }
  });
}

process.on('SIGTERM', async () => {
  await closeBackgroundWorkers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeBackgroundWorkers();
  process.exit(0);
});

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, server };
