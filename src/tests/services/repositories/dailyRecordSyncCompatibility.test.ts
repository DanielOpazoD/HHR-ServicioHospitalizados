import { describe, expect, it } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import {
  mergeAvailableDates,
  resolvePreferredDailyRecord,
  shouldKeepLocalRecordOverRemote,
  toRecordTimestamp,
} from '@/services/repositories/dailyRecordSyncCompatibility';

const buildRecord = (date: string, lastUpdated: string): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated,
    nurses: [],
    activeExtraBeds: [],
  }) as DailyRecord;

describe('dailyRecordSyncCompatibility', () => {
  it('parses invalid timestamps as zero', () => {
    expect(toRecordTimestamp('invalid-date')).toBe(0);
    expect(toRecordTimestamp(undefined)).toBe(0);
  });

  it('keeps local record when it is newer than remote', () => {
    const local = buildRecord('2026-03-01', '2026-03-01T12:00:00.000Z');
    const remote = buildRecord('2026-03-01', '2026-03-01T08:00:00.000Z');

    expect(shouldKeepLocalRecordOverRemote(local, remote)).toBe(true);
    expect(resolvePreferredDailyRecord(local, remote)).toBe(local);
  });

  it('prefers local record when timestamps are equal', () => {
    const local = buildRecord('2026-03-01', '2026-03-01T09:00:00.000Z');
    const remote = buildRecord('2026-03-01', '2026-03-01T09:00:00.000Z');

    expect(shouldKeepLocalRecordOverRemote(local, remote)).toBe(true);
    expect(resolvePreferredDailyRecord(local, remote)).toBe(local);
  });

  it('prefers remote record when local timestamp is missing or older', () => {
    const local = buildRecord('2026-03-01', '');
    const remote = buildRecord('2026-03-01', '2026-03-01T08:00:00.000Z');

    expect(shouldKeepLocalRecordOverRemote(local, remote)).toBe(false);
    expect(resolvePreferredDailyRecord(local, remote)).toBe(remote);
  });

  it('merges available dates without duplicates in descending order', () => {
    expect(mergeAvailableDates(['2026-03-02', '2026-03-01'], ['2026-03-03', '2026-03-01'])).toEqual(
      ['2026-03-03', '2026-03-02', '2026-03-01']
    );
  });
});
