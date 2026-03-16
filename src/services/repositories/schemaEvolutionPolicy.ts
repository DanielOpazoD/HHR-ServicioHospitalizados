import { CURRENT_SCHEMA_VERSION, LEGACY_SCHEMA_VERSION } from '@/constants/version';
import type { DailyRecord } from '@/types/domain/dailyRecord';

export type SchemaCompatibilityDisposition =
  | 'current'
  | 'migrate'
  | 'forward_incompatible'
  | 'legacy_bridge';

export interface SchemaCompatibilityAssessment {
  sourceVersion: number;
  targetVersion: number;
  disposition: SchemaCompatibilityDisposition;
  requiresMigration: boolean;
  aheadOfRuntime: boolean;
  legacyBridgeCandidate: boolean;
}

export const assessSchemaCompatibility = (
  record: Partial<DailyRecord> | null | undefined
): SchemaCompatibilityAssessment => {
  const rawVersion = record?.schemaVersion;
  const normalizedVersion =
    typeof rawVersion === 'number' && Number.isFinite(rawVersion)
      ? Math.floor(rawVersion)
      : LEGACY_SCHEMA_VERSION;

  if (normalizedVersion > CURRENT_SCHEMA_VERSION) {
    return {
      sourceVersion: normalizedVersion,
      targetVersion: CURRENT_SCHEMA_VERSION,
      disposition: 'forward_incompatible',
      requiresMigration: false,
      aheadOfRuntime: true,
      legacyBridgeCandidate: false,
    };
  }

  if (normalizedVersion <= LEGACY_SCHEMA_VERSION) {
    return {
      sourceVersion: LEGACY_SCHEMA_VERSION,
      targetVersion: CURRENT_SCHEMA_VERSION,
      disposition: 'legacy_bridge',
      requiresMigration: true,
      aheadOfRuntime: false,
      legacyBridgeCandidate: true,
    };
  }

  if (normalizedVersion < CURRENT_SCHEMA_VERSION) {
    return {
      sourceVersion: normalizedVersion,
      targetVersion: CURRENT_SCHEMA_VERSION,
      disposition: 'migrate',
      requiresMigration: true,
      aheadOfRuntime: false,
      legacyBridgeCandidate: false,
    };
  }

  return {
    sourceVersion: CURRENT_SCHEMA_VERSION,
    targetVersion: CURRENT_SCHEMA_VERSION,
    disposition: 'current',
    requiresMigration: false,
    aheadOfRuntime: false,
    legacyBridgeCandidate: false,
  };
};
