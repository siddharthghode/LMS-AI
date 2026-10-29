import { Queue } from 'bullmq';
import { config } from '../config';

export const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

// Queue names
export const QUEUE_NAMES = {
  STREAK: 'streak-evaluation-queue',
  INGESTION: 'lecture-ingestion-queue',
  NOTIFICATION: 'notification-dispatch-queue',
} as const;

// BullMQ Queues
export const streakQueue = new Queue(QUEUE_NAMES.STREAK, { connection });
export const ingestionQueue = new Queue(QUEUE_NAMES.INGESTION, { connection });
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, { connection });
