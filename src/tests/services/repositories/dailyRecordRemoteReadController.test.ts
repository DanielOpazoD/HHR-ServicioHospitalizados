import { describe, expect, it, vi } from 'vitest';

import { AdmissionDatePolicyViolationError } from '@/application/patient-flow/admissionDatePolicy';
import { resolveRemoteGoldenPathReadResult } from '@/services/repositories/dailyRecordRemoteReadController';
import { createLocalRuntimeReadCandidate } from '@/services/repositories/dailyRecordReadResultController';
import type { DailyRecordRemoteLoadResult } from '@/services/repositories/dailyRecordRemoteLoader';
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

const buildRemoteLoad = (record: DailyRecord | null): DailyRecordRemoteLoadResult => ({
  record,
  source: record ? 'firestore' : 'not_found',
  compatibilityTier: record ? 'current_firestore' : 'none',
  compatibilityIntensity: 'none',
  migrationRulesApplied: [],
  cachedLocally: false,
});

describe('dailyRecordRemoteReadController', () => {
  it('hydrates local cache and returns the remote authoritative result when remote is newer', async () => {
    const localRecord = buildRecord('2026-04-15', '2026-04-15T08:00:00.000Z');
    const remoteRecord = buildRecord('2026-04-15', '2026-04-15T12:00:00.000Z');
    const persistHydratedRecord = vi.fn().mockResolvedValue(remoteRecord);

    const result = await resolveRemoteGoldenPathReadResult({
      date: '2026-04-15',
      localCandidate: createLocalRuntimeReadCandidate('2026-04-15', localRecord),
      remoteReadResult: buildRemoteLoad(remoteRecord),
      persistHydratedRecord,
    });

    expect(persistHydratedRecord).toHaveBeenCalledOnce();
    expect(persistHydratedRecord.mock.calls[0]?.[0]).toEqual(remoteRecord);
    expect(persistHydratedRecord.mock.calls[0]?.[1]).toBe('2026-04-15');
    expect(persistHydratedRecord.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        date: '2026-04-15',
        lastUpdated: localRecord.lastUpdated,
      })
    );
    expect(result.source).toBe('firestore');
    expect(result.record?.lastUpdated).toBe(remoteRecord.lastUpdated);
    expect(result.consistencyState).toBe('remote_authoritative');
  });

  it('keeps the local result when remote is older', async () => {
    const localRecord = buildRecord('2026-04-15', '2026-04-15T12:00:00.000Z');
    const remoteRecord = buildRecord('2026-04-15', '2026-04-15T08:00:00.000Z');
    const persistHydratedRecord = vi.fn();

    const result = await resolveRemoteGoldenPathReadResult({
      date: '2026-04-15',
      localCandidate: createLocalRuntimeReadCandidate('2026-04-15', localRecord),
      remoteReadResult: buildRemoteLoad(remoteRecord),
      persistHydratedRecord,
    });

    expect(persistHydratedRecord).not.toHaveBeenCalled();
    expect(result.source).toBe('indexeddb');
    expect(result.record?.lastUpdated).toBe(localRecord.lastUpdated);
    expect(result.sourceOfTruth).toBe('local');
  });

  it('skips hydration when admission date policy blocks local persistence', async () => {
    const localRecord = buildRecord('2026-04-15', '2026-04-15T08:00:00.000Z');
    const remoteRecord = buildRecord('2026-04-15', '2026-04-15T12:00:00.000Z');
    const persistHydratedRecord = vi
      .fn()
      .mockRejectedValue(new AdmissionDatePolicyViolationError('blocked hydration', []));

    const result = await resolveRemoteGoldenPathReadResult({
      date: '2026-04-15',
      localCandidate: createLocalRuntimeReadCandidate('2026-04-15', localRecord),
      remoteReadResult: buildRemoteLoad(remoteRecord),
      persistHydratedRecord,
    });

    expect(persistHydratedRecord).toHaveBeenCalledOnce();
    expect(result.source).toBe('firestore');
    expect(result.record?.lastUpdated).toBe(remoteRecord.lastUpdated);
  });
});
