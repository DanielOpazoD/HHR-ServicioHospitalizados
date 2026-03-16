import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataFactory } from '@/tests/factories/DataFactory';
import {
  bridgeLegacyRecord,
  bridgeLegacyRecordsRange,
  getLegacyBridgeUsageSummary,
  listRecentLegacyBridgeOperations,
} from '@/services/repositories/legacyRecordBridgeService';

vi.mock('@/services/storage/migration/legacyFirestoreBridge', () => ({
  getLegacyRecord: vi.fn(),
  getLegacyRecordsRange: vi.fn(),
}));

vi.mock('@/services/storage/records', () => ({
  saveRecord: vi.fn(),
}));

import {
  getLegacyRecord,
  getLegacyRecordsRange,
} from '@/services/storage/migration/legacyFirestoreBridge';
import { saveRecord } from '@/services/storage/records';

describe('legacyRecordBridgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_LEGACY_COMPATIBILITY_MODE', 'explicit_bridge');
  });

  it('bridges a legacy record only through the explicit bridge service', async () => {
    vi.mocked(getLegacyRecord).mockResolvedValue(DataFactory.createMockDailyRecord('2025-01-01'));

    const result = await bridgeLegacyRecord('2025-01-01');

    expect(result.source).toBe('legacy_bridge');
    expect(result.status).toBe('legacy_bridge');
    expect(result.scope).toBe('single');
    expect(result.compatibilityTier).toBe('legacy_bridge');
    expect(result.cachedLocally).toBe(true);
    expect(result.auditId).toBeTruthy();
    expect(result.retirementPhase).toBe('restrict');
    expect(result.candidatePaths?.[0]).toContain('hospitals/hanga_roa/dailyRecords/2025-01-01');
    expect(saveRecord).toHaveBeenCalled();
    expect(getLegacyBridgeUsageSummary().bridgedOperations).toBeGreaterThan(0);
  });

  it('returns no data when the bridge is disabled', async () => {
    vi.stubEnv('VITE_LEGACY_COMPATIBILITY_MODE', 'disabled');

    const result = await bridgeLegacyRecord('2025-01-01');

    expect(result.source).toBe('not_found');
    expect(result.status).toBe('disabled');
    expect(result.retirementPhase).toBe('retire_ready');
    expect(vi.mocked(getLegacyRecord)).not.toHaveBeenCalled();
  });

  it('bridges legacy ranges in chronological order', async () => {
    vi.mocked(getLegacyRecordsRange).mockResolvedValue([
      DataFactory.createMockDailyRecord('2025-01-03'),
      DataFactory.createMockDailyRecord('2025-01-02'),
    ]);

    const results = await bridgeLegacyRecordsRange('2025-01-01', '2025-01-03');

    expect(results.map(result => result.record?.date)).toEqual(['2025-01-02', '2025-01-03']);
    expect(results.every(result => result.scope === 'range')).toBe(true);
    expect(listRecentLegacyBridgeOperations(5)[0]?.scope).toBe('range');
  });
});
