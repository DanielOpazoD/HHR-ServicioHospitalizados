import type { DailyRecord } from '@/types';
import type {
  LegacyMigrationRule,
  MigrationCompatibilityIntensity,
} from '@/services/repositories/dataMigrationContracts';

export interface LegacyBridgeLoadResult {
  record: DailyRecord | null;
  source: 'legacy_bridge' | 'not_found';
  compatibilityTier: 'legacy_bridge' | 'none';
  compatibilityIntensity: MigrationCompatibilityIntensity;
  migrationRulesApplied: LegacyMigrationRule[];
  cachedLocally: boolean;
  candidatePaths?: string[];
}
