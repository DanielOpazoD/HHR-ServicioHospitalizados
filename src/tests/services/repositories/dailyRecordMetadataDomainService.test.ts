import { describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import {
  createRecordDateTimestamp,
  ensureDailyRecordDateTimestamp,
  touchDailyRecordLastUpdated,
} from '@/services/repositories/dailyRecordMetadataDomainService';

describe('dailyRecordMetadataDomainService', () => {
  it('creates and assigns date timestamps from canonical dates', () => {
    const record = { date: '2026-02-19' } as DailyRecord;

    ensureDailyRecordDateTimestamp(record);

    expect(createRecordDateTimestamp('2026-02-19')).toBe(Date.parse('2026-02-19T00:00:00'));
    expect(record.dateTimestamp).toBe(Date.parse('2026-02-19T00:00:00'));
  });

  it('repairs legacy date timestamps that do not match the canonical record date', () => {
    const record = {
      date: '2026-02-19',
      dateTimestamp: Date.parse('2026-02-19T00:00:00.000Z'),
    } as DailyRecord;

    ensureDailyRecordDateTimestamp(record);

    expect(record.dateTimestamp).toBe(Date.parse('2026-02-19T00:00:00'));
  });

  it('touches lastUpdated with a fresh iso timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T14:15:16.000Z'));
    const record = { lastUpdated: '' } as DailyRecord;

    touchDailyRecordLastUpdated(record);

    expect(record.lastUpdated).toBe('2026-03-02T14:15:16.000Z');
    vi.useRealTimers();
  });
});
