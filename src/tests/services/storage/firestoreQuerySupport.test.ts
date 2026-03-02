import { describe, expect, it } from 'vitest';
import {
  buildFirestoreMonthDateRange,
  toFirestoreRecordMap,
} from '@/services/storage/firestore/firestoreQuerySupport';
import { DailyRecord } from '@/types';

describe('firestoreQuerySupport', () => {
  it('builds month date range for zero-based month indexes', () => {
    expect(buildFirestoreMonthDateRange(2024, 11)).toEqual({
      startDate: '2024-12-01',
      endDate: '2024-12-31',
    });
  });

  it('creates a record map keyed by record date', () => {
    const records = [{ date: '2024-12-01' }, { date: '2024-12-02' }] as DailyRecord[];

    expect(toFirestoreRecordMap(records)).toEqual({
      '2024-12-01': records[0],
      '2024-12-02': records[1],
    });
  });
});
