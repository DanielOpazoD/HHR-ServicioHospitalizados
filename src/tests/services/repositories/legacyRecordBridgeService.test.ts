import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataFactory } from '@/tests/factories/DataFactory';
import {
  bridgeLegacyRecord,
  bridgeLegacyRecordsRange,
} from '@/services/repositories/legacyRecordBridgeService';

vi.mock('@/services/storage/legacyFirebaseService', () => ({
  getLegacyRecord: vi.fn(),
  getLegacyRecordsRange: vi.fn(),
}));

vi.mock('@/services/storage/indexedDBService', () => ({
  saveRecord: vi.fn(),
}));

import { getLegacyRecord, getLegacyRecordsRange } from '@/services/storage/legacyFirebaseService';
import { saveRecord } from '@/services/storage/indexedDBService';

describe('legacyRecordBridgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_LEGACY_COMPATIBILITY_MODE', 'explicit_bridge');
  });

  it('bridges a legacy record only through the explicit bridge service', async () => {
    vi.mocked(getLegacyRecord).mockResolvedValue(DataFactory.createMockDailyRecord('2025-01-01'));

    const result = await bridgeLegacyRecord('2025-01-01');

    expect(result.source).toBe('legacy_bridge');
    expect(result.compatibilityTier).toBe('legacy_bridge');
    expect(result.cachedLocally).toBe(true);
    expect(saveRecord).toHaveBeenCalled();
  });

  it('returns no data when the bridge is disabled', async () => {
    vi.stubEnv('VITE_LEGACY_COMPATIBILITY_MODE', 'disabled');

    const result = await bridgeLegacyRecord('2025-01-01');

    expect(result.source).toBe('not_found');
    expect(vi.mocked(getLegacyRecord)).not.toHaveBeenCalled();
  });

  it('bridges legacy ranges in chronological order', async () => {
    vi.mocked(getLegacyRecordsRange).mockResolvedValue([
      DataFactory.createMockDailyRecord('2025-01-03'),
      DataFactory.createMockDailyRecord('2025-01-02'),
    ]);

    const results = await bridgeLegacyRecordsRange('2025-01-01', '2025-01-03');

    expect(results.map(result => result.record?.date)).toEqual(['2025-01-02', '2025-01-03']);
  });
});
