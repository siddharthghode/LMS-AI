import { Worker, Job } from 'bullmq';
import { connection, QUEUE_NAMES, streakQueue, ingestionQueue, notificationQueue } from './queues';
import { pool } from '../config/db';
import { triggerLectureIngestion } from '../modules/ai/ai.service';

let streakWorker: Worker | null = null;
let ingestionWorker: Worker | null = null;
let notificationWorker: Worker | null = null;

export function initBackgroundWorkers() {
  console.log('[BullMQ] Initializing background workers...');

  // 1. Streak Evaluation Worker
  streakWorker = new Worker(
    QUEUE_NAMES.STREAK,
    async (job: Job) => {
      console.log(`[Streak Worker] Processing job ${job.id} (${job.name})`);
      const resetRes = await pool.query(
        `UPDATE streaks
         SET current_streak = 0
         WHERE last_active_date < CURRENT_DATE - INTERVAL '1 day'
           AND current_streak > 0
         RETURNING user_id`
      );

      console.log(`[Streak Worker] Evaluated streaks: ${resetRes.rowCount} inactive users reset to 0.`);
      return {
        jobId: job.id,
        resetCount: resetRes.rowCount,
        processedAt: new Date().toISOString(),
      };
    },
    { connection, concurrency: 2 }
  );

  streakWorker.on('completed', (job, returnvalue) => {
    console.log(`[Streak Worker] Job ${job?.id} completed successfully:`, returnvalue);
  });

  streakWorker.on('failed', (job, err) => {
    console.error(`[Streak Worker] Job ${job?.id} failed:`, err.message);
  });

  // 2. Lecture Ingestion Worker
  ingestionWorker = new Worker(
    QUEUE_NAMES.INGESTION,
    async (job: Job) => {
      const { courseId, lectureId, transcript } = job.data;
      console.log(`[Ingestion Worker] Processing lecture ${lectureId} for course ${courseId}...`);

      await triggerLectureIngestion(courseId, lectureId, transcript || '');
      return {
        jobId: job.id,
        courseId,
        lectureId,
        completedAt: new Date().toISOString(),
      };
    },
    { connection, concurrency: 3 }
  );

  ingestionWorker.on('completed', (job) => {
    console.log(`[Ingestion Worker] Job ${job?.id} finished ingestion successfully.`);
  });

  ingestionWorker.on('failed', (job, err) => {
    console.error(`[Ingestion Worker] Job ${job?.id} failed:`, err.message);
  });

  // 3. Notification Dispatch Worker
  notificationWorker = new Worker(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job) => {
      const { courseId, title, content } = job.data;
      console.log(`[Notification Worker] Broadcasting notice "${title}" for course ${courseId}`);

      const insertRes = await pool.query(
        `INSERT INTO notifications (user_id, title, body)
         SELECT user_id, $2, $3
         FROM enrollments
         WHERE course_id = $1`,
        [courseId, `Announcement: ${title}`, content || 'New course announcement posted.']
      );

      console.log(`[Notification Worker] Dispatched ${insertRes.rowCount} notifications.`);
      return {
        jobId: job.id,
        dispatchedCount: insertRes.rowCount,
        completedAt: new Date().toISOString(),
      };
    },
    { connection, concurrency: 5 }
  );

  notificationWorker.on('completed', (job, result) => {
    console.log(`[Notification Worker] Job ${job?.id} completed:`, result);
  });

  notificationWorker.on('failed', (job, err) => {
    console.error(`[Notification Worker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[BullMQ] Background workers registered and listening for Redis queue events.');
}

export async function closeBackgroundWorkers() {
  console.log('[BullMQ] Closing background workers and queues...');
  await Promise.allSettled([
    streakWorker?.close(),
    ingestionWorker?.close(),
    notificationWorker?.close(),
    streakQueue.close(),
    ingestionQueue.close(),
    notificationQueue.close(),
  ]);
}

export async function getQueueStats() {
  const [streakCounts, ingestionCounts, notificationCounts] = await Promise.all([
    streakQueue.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting'),
    ingestionQueue.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting'),
    notificationQueue.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting'),
  ]);

  return {
    streak: streakCounts,
    ingestion: ingestionCounts,
    notification: notificationCounts,
  };
}
