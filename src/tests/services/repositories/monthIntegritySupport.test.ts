import { describe, expect, it } from 'vitest';
import {
  buildMonthIntegrityDate,
  buildMonthIntegrityDateRange,
  createMonthIntegrityResult,
  getPreviousMonthIntegrityDate,
} from '@/services/repositories/monthIntegritySupport';

describe('monthIntegritySupport', () => {
  it('formats month integrity dates with zero padding', () => {
    expect(buildMonthIntegrityDate(2026, 3, 7)).toBe('2026-03-07');
  });

  it('builds the expected date range up to a target day', () => {
    expect(buildMonthIntegrityDateRange(2026, 3, 3)).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
    ]);
  });

  it('returns previous date only when there is a previous day in month', () => {
    expect(getPreviousMonthIntegrityDate(2026, 3, 1)).toBeUndefined();
    expect(getPreviousMonthIntegrityDate(2026, 3, 2)).toBe('2026-03-01');
  });

  it('builds a result object with success derived from errors', () => {
    expect(createMonthIntegrityResult(['2026-03-01'], [], 3)).toEqual({
      success: true,
      initializedDays: ['2026-03-01'],
      errors: [],
      totalDays: 3,
    });
    expect(createMonthIntegrityResult([], ['2026-03-02'], 3).success).toBe(false);
  });
});
