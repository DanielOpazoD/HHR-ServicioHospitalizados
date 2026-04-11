import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/application/ports/dailyRecordPort');

import {
  defaultDailyRecordReadPort,
  defaultDailyRecordRepositoryPort,
  defaultDailyRecordWritePort,
} from '@/application/ports/dailyRecordPort';

const readService = {
  getForDate: vi.fn(),
  getForDateWithMeta: vi.fn(),
  getPreviousDay: vi.fn(),
  getPreviousDayWithMeta: vi.fn(),
  getAvailableDates: vi.fn(),
};

const initializationService = {
  initializeDay: vi.fn(),
  copyPatientToDateDetailed: vi.fn(),
};

const writeService = {
  updatePartialDetailed: vi.fn(),
  saveDetailed: vi.fn(),
};

const facadeSupportService = {
  deleteDailyRecordAcrossStores: vi.fn(),
};

const syncService = {
  syncWithFirestoreDetailed: vi.fn(),
  subscribe: vi.fn(),
  subscribeDetailed: vi.fn(),
};

const firestoreService = {
  getMonthRecordsFromFirestore: vi.fn(),
};

vi.mock('@/services/repositories/dailyRecordRepositoryReadService', () => readService);
vi.mock(
  '@/services/repositories/dailyRecordRepositoryInitializationService',
  () => initializationService
);
vi.mock('@/services/repositories/dailyRecordRepositoryWriteService', () => writeService);
vi.mock('@/services/repositories/dailyRecordRepositoryFacadeSupport', () => facadeSupportService);
vi.mock('@/services/repositories/dailyRecordRepositorySyncService', () => syncService);
vi.mock('@/services/storage/firestore', () => firestoreService);

describe('dailyRecordPort lazy facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates read, write and firestore-backed queries through lazy services', async () => {
    readService.getForDate.mockResolvedValue({ id: 'record' });
    writeService.updatePartialDetailed.mockResolvedValue({ outcome: 'saved' });
    facadeSupportService.deleteDailyRecordAcrossStores.mockResolvedValue(undefined);
    firestoreService.getMonthRecordsFromFirestore.mockResolvedValue([{ id: 'month-record' }]);

    await defaultDailyRecordReadPort.getForDate('2026-04-10');
    await defaultDailyRecordReadPort.getMonthRecords(2026, 3);
    await defaultDailyRecordWritePort.updatePartial('2026-04-10', {
      patientName: 'Ana',
    });
    await defaultDailyRecordRepositoryPort.deleteDay('2026-04-10');

    expect(readService.getForDate).toHaveBeenCalledWith('2026-04-10');
    expect(firestoreService.getMonthRecordsFromFirestore).toHaveBeenCalledWith(2026, 3);
    expect(writeService.updatePartialDetailed).toHaveBeenCalledWith('2026-04-10', {
      patientName: 'Ana',
    });
    expect(facadeSupportService.deleteDailyRecordAcrossStores).toHaveBeenCalledWith('2026-04-10');
  });

  it('attaches and tears down the lazy sync subscription once the module resolves', async () => {
    const unsubscribe = vi.fn();
    syncService.subscribe.mockReturnValue(unsubscribe);

    const stop = defaultDailyRecordRepositoryPort.subscribe('2026-04-10', vi.fn());
    await vi.waitFor(() => {
      expect(syncService.subscribe).toHaveBeenCalledWith('2026-04-10', expect.any(Function));
    });

    stop();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
