import type { DailyRecordStoreChangedEventDetail } from '@/services/storage/indexeddb/indexedDbRecordEvents';

const CHANNEL_NAME = 'hhr_records_sync_channel';

const TAB_ID: string =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab_${Math.random().toString(36).slice(2)}`;

export type SyncBroadcastMessage = {
  type: 'DAILY_RECORD_STORE_CHANGED';
  detail: DailyRecordStoreChangedEventDetail;
  tabId: string;
};

let channel: BroadcastChannel | null = null;

const getChannel = (): BroadcastChannel | null => {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return channel;
};

export const broadcastDailyRecordStoreChanged = (
  detail: DailyRecordStoreChangedEventDetail
): void => {
  getChannel()?.postMessage({
    type: 'DAILY_RECORD_STORE_CHANGED',
    detail,
    tabId: TAB_ID,
  } satisfies SyncBroadcastMessage);
};

export const onSyncBroadcastMessage = (
  callback: (message: SyncBroadcastMessage) => void
): (() => void) => {
  const ch = getChannel();
  if (!ch) return () => {};

  const handler = (event: MessageEvent<SyncBroadcastMessage>) => {
    if (event.data?.tabId === TAB_ID) return;
    callback(event.data);
  };

  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
};

export const resetSyncBroadcastChannelForTests = (): void => {
  channel?.close();
  channel = null;
};
