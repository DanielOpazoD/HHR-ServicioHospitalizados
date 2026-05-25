import type { SyncQueueEnqueueOptions } from '@/services/storage/sync/syncQueueEnqueuePolicy';

const PRE_OUTBOX_DIRECT_WRITE_HOLD_MS = 5_000;

export const buildPreOutboxRemoteAckOptions = (syncContract: {
  tabId?: string;
  clientId?: string;
}): SyncQueueEnqueueOptions => ({
  deferProcessing: true,
  holdForMs: PRE_OUTBOX_DIRECT_WRITE_HOLD_MS,
  preOutboxHoldOwner: syncContract.tabId || syncContract.clientId || 'unknown_direct_writer',
  preOutboxHoldReason: 'awaiting_remote_ack',
});
