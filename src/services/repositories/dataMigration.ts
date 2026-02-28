/**
 * Data Migration Service
 * Handles migration of legacy data formats to current schema.
 *
 * Clinical Justification: Ensures that clinical data recorded in older versions
 * of the app remains consistent and usable for audits, even as data structures evolve.
 * Prevents "silent corruption" of historical patient records.
 */

import { DailyRecord } from '@/types';
import { parseDailyRecordWithDefaults } from '@/schemas/zodSchemas';
import { normalizeDailyRecordInvariants } from '@/utils/recordInvariants';

type LegacyDailyRecordShape = DailyRecord & {
  nurseName?: string;
  tens?: string[];
};

const migrateLegacyNurses = (record: LegacyDailyRecordShape, migrated: DailyRecord): void => {
  if (migrated.nurses && migrated.nurses.length > 0) {
    const hasNurses = migrated.nurses.some(n => !!n);
    const isDayShiftEmpty = !migrated.nursesDayShift || migrated.nursesDayShift.every(n => !n);

    if (hasNurses && isDayShiftEmpty) {
      migrated.nursesDayShift = [...migrated.nurses];
    }
  }

  if (migrated.nurseName && (!migrated.nursesDayShift || !migrated.nursesDayShift[0])) {
    if (!migrated.nursesDayShift) migrated.nursesDayShift = ['', ''];
    migrated.nursesDayShift[0] = migrated.nurseName;
  }
};

const migrateLegacyTens = (record: LegacyDailyRecordShape, migrated: DailyRecord): void => {
  const rawTens = record.tens;
  if (!Array.isArray(rawTens) || rawTens.length === 0) return;

  const hasTens = rawTens.some(t => !!t);
  const isDayTensEmpty = !migrated.tensDayShift || migrated.tensDayShift.every(t => !t);
  if (!hasTens || !isDayTensEmpty) return;

  const paddedTens = [...rawTens];
  while (paddedTens.length < 3) paddedTens.push('');
  migrated.tensDayShift = paddedTens.slice(0, 3);
};

const enforceSchemaVersionFloor = (migrated: DailyRecord): void => {
  migrated.schemaVersion = Math.max(migrated.schemaVersion || 0, 1);
};

/**
 * Migrates legacy data formats to the current schema using Zod for robust validation.
 *
 * @param record - The record to migrate (potentially in legacy format)
 * @param date - The date string for the record
 * @returns Fully migrated and validated DailyRecord
 */
export const migrateLegacyData = (record: DailyRecord, date: string): DailyRecord => {
  const normalizedRecord = record as LegacyDailyRecordShape;

  // 1. Initial pass through Zod to apply defaults and recover basic structure
  let migrated = parseDailyRecordWithDefaults(normalizedRecord, date);

  // 2. Apply invariants so the current runtime never sees sparse bed maps.
  migrated = normalizeDailyRecordInvariants(migrated).record;

  // 3. Apply explicit legacy compatibility rules that are still supported.
  migrateLegacyNurses(normalizedRecord, migrated);
  migrateLegacyTens(normalizedRecord, migrated);
  enforceSchemaVersionFloor(migrated);

  return migrated;
};
