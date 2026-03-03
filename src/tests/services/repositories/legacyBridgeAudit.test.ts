import { describe, expect, it, beforeEach } from 'vitest';
import {
  getLegacyBridgeAuditSummary,
  listRecentLegacyBridgeAuditEntries,
  recordLegacyBridgeAuditEntry,
  resetLegacyBridgeAuditForTests,
} from '@/services/repositories/legacyBridgeAudit';
import type { LegacyBridgeLoadResult } from '@/services/repositories/ports/repositoryLegacyBridgePort';

const buildResult = (overrides: Partial<LegacyBridgeLoadResult> = {}): LegacyBridgeLoadResult => ({
  source: 'legacy_bridge',
  status: 'legacy_bridge',
  scope: 'single',
  record: null,
  compatibilityTier: 'legacy_bridge',
  compatibilityIntensity: 'legacy_schema_bridge',
  migrationRulesApplied: [],
  cachedLocally: false,
  candidatePaths: ['records/2025-01-01'],
  retirementPhase: 'restrict',
  ...overrides,
});

describe('legacyBridgeAudit', () => {
  beforeEach(() => {
    resetLegacyBridgeAuditForTests();
  });

  it('records legacy bridge entries and summarizes them', () => {
    const id = recordLegacyBridgeAuditEntry(buildResult(), 'single', '2025-01-01', 1);
    recordLegacyBridgeAuditEntry(
      buildResult({ source: 'not_found', status: 'not_found', compatibilityTier: 'none' }),
      'range',
      '2025-01-01:2025-01-03',
      0
    );

    const entries = listRecentLegacyBridgeAuditEntries();
    const summary = getLegacyBridgeAuditSummary();

    expect(id).toBe('legacy-bridge-1');
    expect(entries).toHaveLength(2);
    expect(entries[0].scope).toBe('range');
    expect(summary.bridgedOperations).toBe(1);
    expect(summary.notFoundOperations).toBe(1);
    expect(summary.rangeOperations).toBe(1);
  });
});
