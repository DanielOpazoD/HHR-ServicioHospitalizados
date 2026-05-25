import type { SyncTask } from '@/services/storage/syncQueueTypes';

export interface SyncQueueEnqueueOptions {
  deferProcessing?: boolean;
  holdForMs?: number;
}

export const countActiveSyncTasks = (tasks: SyncTask[]): number =>
  tasks.filter(task => task.status === 'PENDING' || task.status === 'PROCESSING').length;

export const resolveSyncTaskNextAttemptAt = (
  now: number,
  options: SyncQueueEnqueueOptions
): number => (options.holdForMs && options.holdForMs > 0 ? now + options.holdForMs : 0);
