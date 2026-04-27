import { describe, expect, it, vi } from 'vitest';

import { createLocalRuntimeReadCandidate } from '@/services/repositories/dailyRecordReadResultController';
import {
  attemptRemoteGoldenPathRead,
  resolveRemoteGoldenPathReadResult,
} from '@/services/repositories/dailyRecordRemoteReadController';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';

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

const buildPatient = (bedId: string, overrides: Partial<PatientData> = {}): PatientData => ({
  bedId,
  isBlocked: false,
  bedMode: 'Cama',
  hasCompanionCrib: false,
  patientName: '',
  rut: '',
  age: '',
  pathology: '',
  specialty: Specialty.MEDICINA,
  status: PatientStatus.ESTABLE,
  admissionDate: '2026-03-19',
  hasWristband: false,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
  ...overrides,
});

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
    remote.beds = {
      R1: buildPatient('R1', {
        patientName: 'REMOTE PATIENT',
        pathology: 'REMOTE DX',
      }),
    };
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
      expect.objectContaining({
        beds: expect.objectContaining({
          R1: expect.objectContaining({
            patientName: 'REMOTE PATIENT',
            pathology: 'REMOTE DX',
          }),
        }),
      }),
      '2026-03-19',
      expect.objectContaining({
        date: local.date,
        lastUpdated: local.lastUpdated,
      })
    );
  });

  it('merges remote hydration with local clinical edits before replacing the cache', async () => {
    const local = buildRecord('2026-03-19', '2026-03-19T08:00:00.000Z');
    local.beds = {
      R1: buildPatient('R1', {
        patientName: 'LOCAL PATIENT',
        pathology: 'LOCAL OFFLINE DX',
      }),
    };

    const remote = buildRecord('2026-03-19', '2026-03-19T12:00:00.000Z');
    remote.beds = {
      R1: buildPatient('R1', {
        patientName: 'REMOTE PATIENT',
        pathology: 'REMOTE BASE DX',
      }),
      R2: buildPatient('R2', {
        patientName: 'REMOTE NEW PATIENT',
        pathology: 'REMOTE NEW DX',
      }),
    };
    const persistHydratedRecord = vi.fn(async (record: DailyRecord) => record);

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

    expect(result.record?.beds.R1.pathology).toBe('LOCAL OFFLINE DX');
    expect(result.record?.beds.R2.patientName).toBe('REMOTE NEW PATIENT');
    expect(persistHydratedRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        beds: expect.objectContaining({
          R1: expect.objectContaining({ pathology: 'LOCAL OFFLINE DX' }),
          R2: expect.objectContaining({ patientName: 'REMOTE NEW PATIENT' }),
        }),
      }),
      '2026-03-19',
      expect.any(Object)
    );
  });
});
