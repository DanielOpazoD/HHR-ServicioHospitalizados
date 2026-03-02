/**
 * Month Integrity Service
 * Ensures all days in a month have initialized records.
 *
 * Clinical Justification: Prevents data gaps that could affect
 * statistical calculations and audit trails.
 */

import { getForDate, initializeDay } from './DailyRecordRepository';
import {
  buildMonthIntegrityDateRange,
  createMonthIntegrityResult,
  getPreviousMonthIntegrityDate,
  type MonthIntegrityResult,
} from './monthIntegritySupport';

/**
 * Ensures all days of a month up to a specified day are initialized.
 * Creates missing records by copying from the previous day.
 *
 * @param year - The year (e.g., 2025)
 * @param month - The month (1-12)
 * @param upToDay - Initialize up to this day of the month
 * @returns Result with list of initialized days and any errors
 */
export const ensureMonthIntegrity = async (
  year: number,
  month: number,
  upToDay: number
): Promise<MonthIntegrityResult> => {
  const initializedDays: string[] = [];
  const errors: string[] = [];
  const dates = buildMonthIntegrityDateRange(year, month, upToDay);

  for (const [index, date] of dates.entries()) {
    const existing = await getForDate(date);
    if (existing) {
      continue;
    }

    try {
      await initializeDay(date, getPreviousMonthIntegrityDate(year, month, index + 1));
      initializedDays.push(date);
    } catch (_error) {
      errors.push(date);
    }
  }

  return createMonthIntegrityResult(initializedDays, errors, upToDay);
};

export type { MonthIntegrityResult } from './monthIntegritySupport';
