import { describe, expect, it, vi } from 'vitest';

import { createLocalRuntimeReadCandidate } from '@/services/repositories/dailyRecordReadResultController';
import {
  attemptRemoteGoldenPathRead,
  resolveRemoteGoldenPathReadResult,
} from '@/services/repositories/dailyRecordRemoteReadController';
import type { DailyRecord } from '@/types/domain/dailyRecord';

const buildRecord = (date: string, lastUpdated: string): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated,
    nurses: [],
    nursesDayShift: [],
    nursesNightShift: [],
    tensDayShift: [],
    tensNightShift: [],
    activeExtraBeds: [],
    handoffDayChecklist: {},
    handoffNightChecklist: {},
    handoffNightReceives: [],
    handoffNovedadesDayShift: '',
    handoffNovedadesNightShift: '',
    medicalHandoffNovedades: '',
    schemaVersion: 1,
  }) as DailyRecord;

describe('dailyRecordRemoteReadController', () => {
  it('returns a recoverable local result when the remote loader fails', async () => {
    const local = buildRecord('2026-03-19', '2026-03-19T08:00:00.000Z');
    const onRemoteFetchFailure = vi.fn();

    const result = await attemptRemoteGoldenPathRead({
      date: '2026-03-19',
      localCandidate: createLocalRuntimeReadCandidate('2026-03-19', local),
      loadRemoteRecordWithFallback: vi.fn().mockRejectedValue(new Error('remote down')),
      onRemoteFetchFailure,
    });

    expect(result.source).toBe('indexeddb');
    expect(result.record?.lastUpdated).toBe(local.lastUpdated);
    expect(result.retryability).toBe('automatic_retry');
    expect(onRemoteFetchFailure).toHaveBeenCalledWith(expect.any(Error), '2026-03-19');
  });

  it('hydrates local cache when the remote result wins the golden path', async () => {
    const local = buildRecord('2026-03-19', '2026-03-19T08:00:00.000Z');
    const remote = buildRecord('2026-03-19', '2026-03-19T12:00:00.000Z');
    const persistHydratedRecord = vi.fn().mockResolvedValue(remote);

    const result = await resolveRemoteGoldenPathReadResult({
      date: '2026-03-19',
      localCandidate: createLocalRuntimeReadCandidate('2026-03-19', local),
      remoteReadResult: {
        record: remote,
        source: 'firestore',
        compatibilityTier: 'current_firestore',
        compatibilityIntensity: 'none',
        migrationRulesApplied: [],
        cachedLocally: false,
      },
      persistHydratedRecord,
    });

    expect(result.source).toBe('firestore');
    expect(result.consistencyState).toBe('remote_authoritative');
    expect(persistHydratedRecord).toHaveBeenCalledWith(
      remote,
      '2026-03-19',
      expect.objectContaining({
        date: local.date,
        lastUpdated: local.lastUpdated,
      })
    );
  });
});
