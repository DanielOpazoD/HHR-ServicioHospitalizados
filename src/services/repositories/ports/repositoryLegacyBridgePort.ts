import type { DailyRecord } from '@/types/domain/dailyRecord';
import type {
  LegacyMigrationRule,
  MigrationCompatibilityIntensity,
} from '@/services/repositories/dataMigrationContracts';

export interface LegacyBridgeLoadResult {
  record: DailyRecord | null;
  source: 'legacy_bridge' | 'not_found';
  status: 'legacy_bridge' | 'not_found' | 'disabled';
  scope: 'single' | 'range';
  compatibilityTier: 'legacy_bridge' | 'none';
  compatibilityIntensity: MigrationCompatibilityIntensity;
  migrationRulesApplied: LegacyMigrationRule[];
  cachedLocally: boolean;
  candidatePaths?: string[];
  auditId?: string;
  retirementPhase?: 'observe' | 'restrict' | 'retire_ready';
}

export type LegacyBridgeOperationStatus = LegacyBridgeLoadResult['status'];
export type LegacyBridgeOperationScope = LegacyBridgeLoadResult['scope'];
