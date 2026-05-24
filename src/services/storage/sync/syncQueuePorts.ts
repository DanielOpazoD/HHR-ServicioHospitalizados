import type { SyncTask } from '@/services/storage/syncQueueTypes';
import type { DailyRecord } from '@/services/storage/storageDailyRecordContracts';

export type SyncQueueTaskWriteMode = 'created' | 'reused';

export interface SyncQueueStorePort {
  listAll(ownerKey?: string | null): Promise<SyncTask[]>;
  listRecent(limit: number, ownerKey?: string | null): Promise<SyncTask[]>;
  listReadyPending(now: number, limit: number, ownerKey?: string | null): Promise<SyncTask[]>;
  findReusableTask(
    type: SyncTask['type'],
    key: string,
    ownerKey?: string | null
  ): Promise<SyncTask | null>;
  add(task: SyncTask): Promise<void>;
  saveDailyRecordWithTask(record: DailyRecord, task: SyncTask): Promise<SyncQueueTaskWriteMode>;
  update(taskId: number, patch: Partial<SyncTask>): Promise<void>;
  delete(taskId: number): Promise<void>;
  deleteAll(): Promise<void>;
  deleteByOwner(ownerKey: string | null): Promise<void>;
  countForeign(ownerKey: string | null): Promise<number>;
}

export interface SyncRuntimePort {
  isOnline(): boolean;
  onOnline(callback: () => void): void;
  getOwnerKey(): string | null;
}

export interface SyncTransportPort {
  run(task: SyncTask): Promise<void>;
}
