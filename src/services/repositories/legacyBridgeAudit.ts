import type {
  LegacyBridgeLoadResult,
  LegacyBridgeOperationScope,
  LegacyBridgeOperationStatus,
} from '@/services/repositories/ports/repositoryLegacyBridgePort';

export interface LegacyBridgeAuditEntry {
  id: string;
  scope: LegacyBridgeOperationScope;
  status: LegacyBridgeOperationStatus;
  requestedRange: string;
  recordCount: number;
  compatibilityIntensity: LegacyBridgeLoadResult['compatibilityIntensity'];
  candidatePaths: string[];
  migrationRulesApplied: string[];
  timestamp: string;
}

export interface LegacyBridgeAuditSummary {
  totalOperations: number;
  bridgedOperations: number;
  disabledOperations: number;
  notFoundOperations: number;
  rangeOperations: number;
  lastOperationAt: string | null;
}

const MAX_LEGACY_BRIDGE_AUDIT_ENTRIES = 50;

let legacyBridgeAuditSequence = 0;
const recentLegacyBridgeAuditEntries: LegacyBridgeAuditEntry[] = [];

const nextLegacyBridgeAuditId = (): string => {
  legacyBridgeAuditSequence += 1;
  return `legacy-bridge-${legacyBridgeAuditSequence}`;
};

const toMigrationRuleLabels = (rules: LegacyBridgeLoadResult['migrationRulesApplied']): string[] =>
  rules.map(rule => String(rule));

export const recordLegacyBridgeAuditEntry = (
  result: LegacyBridgeLoadResult,
  scope: LegacyBridgeOperationScope,
  requestedRange: string,
  recordCount: number
): string => {
  const id = nextLegacyBridgeAuditId();
  const entry: LegacyBridgeAuditEntry = {
    id,
    scope,
    status: result.status,
    requestedRange,
    recordCount,
    compatibilityIntensity: result.compatibilityIntensity,
    candidatePaths: [...(result.candidatePaths || [])],
    migrationRulesApplied: toMigrationRuleLabels(result.migrationRulesApplied),
    timestamp: new Date().toISOString(),
  };

  recentLegacyBridgeAuditEntries.unshift(entry);
  if (recentLegacyBridgeAuditEntries.length > MAX_LEGACY_BRIDGE_AUDIT_ENTRIES) {
    recentLegacyBridgeAuditEntries.length = MAX_LEGACY_BRIDGE_AUDIT_ENTRIES;
  }

  return id;
};

export const listRecentLegacyBridgeAuditEntries = (limit = 10): LegacyBridgeAuditEntry[] =>
  recentLegacyBridgeAuditEntries.slice(0, Math.max(0, limit)).map(entry => ({
    ...entry,
    candidatePaths: [...entry.candidatePaths],
    migrationRulesApplied: [...entry.migrationRulesApplied],
  }));

export const getLegacyBridgeAuditSummary = (): LegacyBridgeAuditSummary => ({
  totalOperations: recentLegacyBridgeAuditEntries.length,
  bridgedOperations: recentLegacyBridgeAuditEntries.filter(
    entry => entry.status === 'legacy_bridge'
  ).length,
  disabledOperations: recentLegacyBridgeAuditEntries.filter(entry => entry.status === 'disabled')
    .length,
  notFoundOperations: recentLegacyBridgeAuditEntries.filter(entry => entry.status === 'not_found')
    .length,
  rangeOperations: recentLegacyBridgeAuditEntries.filter(entry => entry.scope === 'range').length,
  lastOperationAt: recentLegacyBridgeAuditEntries[0]?.timestamp ?? null,
});

export const resetLegacyBridgeAuditForTests = (): void => {
  legacyBridgeAuditSequence = 0;
  recentLegacyBridgeAuditEntries.length = 0;
};
