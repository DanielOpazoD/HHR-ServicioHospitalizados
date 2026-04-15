import { describe, expect, it } from 'vitest';
import {
  createBridgedDailyRecordReadResult,
  createGoldenPathReadResult,
  createLocalRuntimeReadCandidate,
  createLocalRuntimeReadResult,
  createNotFoundDailyRecordReadResult,
} from '@/services/repositories/dailyRecordReadResultController';
import { resolveDailyRecordPersistenceGoldenPath } from '@/services/repositories/dailyRecordPersistenceGoldenPath';
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

describe('dailyRecordReadResultController', () => {
  it('creates a local runtime read result from a migrated candidate', () => {
    const record = buildRecord('2026-04-15', '2026-04-15T12:00:00.000Z');
    const candidate = createLocalRuntimeReadCandidate(record.date, record);

    const result = createLocalRuntimeReadResult(record.date, candidate, 'indexeddb');

    expect(result.source).toBe('indexeddb');
    expect(result.record?.date).toBe('2026-04-15');
    expect(result.compatibilityTier).toBe('local_runtime');
  });

  it('returns the remote authoritative result when golden path selects remote', () => {
    const local = buildRecord('2026-04-15', '2026-04-15T08:00:00.000Z');
    const remote = buildRecord('2026-04-15', '2026-04-15T12:00:00.000Z');
    const goldenPath = resolveDailyRecordPersistenceGoldenPath({
      localRecord: local,
      remoteRecord: remote,
      remoteAvailability: 'resolved',
      localRepairApplied: false,
      remoteRepairApplied: false,
    });

    const result = createGoldenPathReadResult(
      remote.date,
      goldenPath,
      createLocalRuntimeReadCandidate(local.date, local),
      {
        record: remote,
        source: 'firestore',
        compatibilityTier: 'current_firestore',
        compatibilityIntensity: 'none',
        migrationRulesApplied: [],
        cachedLocally: false,
      }
    );

    expect(result.source).toBe('firestore');
    expect(result.sourceOfTruth).toBe('remote');
    expect(result.record?.lastUpdated).toBe(remote.lastUpdated);
  });

  it('creates explicit not-found results for missing previous-day lookups', () => {
    const result = createNotFoundDailyRecordReadResult('2026-04-15', 'missing');

    expect(result.source).toBe('not_found');
    expect(result.record).toBeNull();
    expect(result.consistencyState).toBe('missing');
  });

  it('creates bridged read results with compatibility metadata intact', () => {
    const bridged = createBridgedDailyRecordReadResult('2026-04-15', {
      record: buildRecord('2026-04-15', '2026-04-15T09:00:00.000Z'),
      source: 'legacy_bridge',
      compatibilityTier: 'legacy_bridge',
      compatibilityIntensity: 'legacy_schema_bridge',
      migrationRulesApplied: ['schema_defaults_applied'],
    });

    expect(bridged.source).toBe('legacy_bridge');
    expect(bridged.compatibilityTier).toBe('legacy_bridge');
    expect(bridged.migrationRulesApplied).toEqual(['schema_defaults_applied']);
  });
});
