import { streakQueue } from './queues';

export async function initStreakScheduler() {
  try {
    // Schedule daily streak check at midnight (00:00 UTC) using BullMQ v5 JobScheduler
    await streakQueue.upsertJobScheduler(
      'daily-streak-maintenance',
      { pattern: '0 0 * * *' },
      {
        name: 'evaluate-streaks',
        data: { automated: true },
      }
    );
    console.log('[Streak Scheduler] Registered repeatable daily streak evaluation cron (0 0 * * *).');
  } catch (err: any) {
    console.warn('[Streak Scheduler] Notice: streak scheduler initialization warning:', err.message);
  }
}

export async function triggerStreakEvaluationNow() {
  const job = await streakQueue.add('evaluate-streaks', {
    manual: true,
    triggeredAt: new Date().toISOString(),
  });
  return job;
}
