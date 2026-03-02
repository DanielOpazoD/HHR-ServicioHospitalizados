import { DailyRecord } from '@/types';
import {
  LegacyMigrationRule,
  MigrationCompatibilityIntensity,
} from '@/services/repositories/dataMigrationContracts';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface GetDailyRecordQuery {
  date: string;
  syncFromRemote: boolean;
}

export interface GetPreviousDayQuery {
  date: string;
}

export type DailyRecordReadSource =
  | 'e2e'
  | 'demo'
  | 'indexeddb'
  | 'firestore'
  | 'legacy_bridge'
  | 'not_found';

export interface DailyRecordReadResult {
  date: string;
  record: DailyRecord | null;
  source: DailyRecordReadSource;
  compatibilityTier: 'local_runtime' | 'current_firestore' | 'legacy_bridge' | 'none';
  compatibilityIntensity: MigrationCompatibilityIntensity;
  migrationRulesApplied: LegacyMigrationRule[];
}

const assertDate = (date: string, operation: string): void => {
  if (!ISO_DATE_REGEX.test(date || '')) {
    throw new Error(`[RepositoryContract] Invalid date format for ${operation}: "${date}"`);
  }
};

export const createGetDailyRecordQuery = (
  date: string,
  syncFromRemote: boolean = true
): GetDailyRecordQuery => {
  assertDate(date, 'getForDate');
  return {
    date,
    syncFromRemote,
  };
};

export const createGetPreviousDayQuery = (date: string): GetPreviousDayQuery => {
  assertDate(date, 'getPreviousDay');
  return { date };
};

export const createDailyRecordReadResult = (
  date: string,
  record: DailyRecord | null,
  source: DailyRecordReadSource,
  options: Partial<
    Pick<
      DailyRecordReadResult,
      'compatibilityTier' | 'compatibilityIntensity' | 'migrationRulesApplied'
    >
  > = {}
): DailyRecordReadResult => {
  assertDate(date, 'createDailyRecordReadResult');
  if (record && record.date !== date) {
    throw new Error(
      `[RepositoryContract] Read result date mismatch. Expected ${date} but received ${record.date}`
    );
  }

  return {
    date,
    record,
    source,
    compatibilityTier: options.compatibilityTier || 'none',
    compatibilityIntensity: options.compatibilityIntensity || 'none',
    migrationRulesApplied: options.migrationRulesApplied || [],
  };
};
