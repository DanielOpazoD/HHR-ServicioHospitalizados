import { describe, expect, it } from 'vitest';
import { evaluateSyncConvergence } from '@/services/observability/syncConvergenceDiagnostics';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';
import type { SyncQueueOperationSnapshot } from '@/services/storage/sync';

const makePatient = (
  bedId: string,
  overrides: Partial<DailyRecord['beds'][string]> = {}
): DailyRecord['beds'][string] => ({
  bedId,
  bedName: `Cama ${bedId}`,
  bedMode: 'Cama',
  hasCompanionCrib: false,
  isBlocked: false,
  patientName: 'Paciente Base',
  rut: '11.111.111-1',
  age: '50',
  pathology: 'Neumonia',
  specialty: Specialty.MEDICINA,
  status: PatientStatus.ESTABLE,
  admissionDate: '2026-07-02',
  hasWristband: true,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
  clinicalEpisodeId: `episode-${bedId}`,
  ...overrides,
});

const makeRecord = (overrides: Partial<DailyRecord> = {}): DailyRecord => ({
  date: '2026-07-02',
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: '2026-07-02T10:00:00.000Z',
  activeExtraBeds: [],
  ...overrides,
});

const makeOutboxOperation = (
  overrides: Partial<SyncQueueOperationSnapshot>
): SyncQueueOperationSnapshot => ({
  id: 1,
  type: 'UPDATE_DAILY_RECORD',
  status: 'PENDING',
  retryCount: 0,
  timestamp: Date.parse('2026-07-02T09:00:00.000Z'),
  key: 'daily:2026-07-02',
  contexts: ['clinical'],
  syncContract: {
    mutationId: 'mutation-1',
    changedPaths: ['discharges.D1'],
  },
  ...overrides,
});

describe('syncConvergenceDiagnostics', () => {
  it('reports healthy when local, remote, outbox and audit are converged', () => {
    const localRecord = makeRecord({
      beds: {
        R1: makePatient('R1', { patientName: 'Ana Perez', rut: '12.345.678-5' }),
      },
    });

    const result = evaluateSyncConvergence({
      localRecord,
      remoteRecord: localRecord,
      outbox: [],
      lastAuditEvent: {
        id: 'audit-1',
        timestamp: '2026-07-02T10:01:00.000Z',
        action: 'PATIENT_MODIFIED',
        entityType: 'patient',
        entityId: 'R1',
        details: {},
      },
      snapshotRecovery: { status: 'available' },
      nowMs: Date.parse('2026-07-02T10:02:00.000Z'),
    });

    expect(result.status).toBe('healthy');
    expect(result.findings).toEqual([]);
    expect(result.summary).toContain('convergida');
  });

  it('classifies duplicate active patients as unsafe', () => {
    const localRecord = makeRecord({
      beds: {
        R1: makePatient('R1', { patientName: 'Ana Perez', rut: '12.345.678-5' }),
        R2: makePatient('R2', { patientName: 'Ana Perez', rut: '12.345.678-5' }),
      },
    });

    const result = evaluateSyncConvergence({
      localRecord,
      remoteRecord: localRecord,
      outbox: [],
      snapshotRecovery: { status: 'available' },
      nowMs: Date.parse('2026-07-02T10:02:00.000Z'),
    });

    expect(result.status).toBe('unsafe');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        type: 'duplicate_active_patient',
        severity: 'critical',
        path: 'beds.R2',
      })
    );
  });

  it('detects movement divergence, stale outbox, repeated replay and missing snapshots', () => {
    const localRecord = makeRecord({
      discharges: [
        {
          id: 'D1',
          bedName: 'Cama R1',
          bedId: 'R1',
          bedType: 'Cama',
          patientName: 'Bernardo Orrego',
          rut: '17.274.300-5',
          diagnosis: 'Alta clinica',
          time: '13:24',
          status: 'Vivo',
        },
      ],
    });
    const remoteRecord = makeRecord();

    const result = evaluateSyncConvergence({
      localRecord,
      remoteRecord,
      outbox: [
        makeOutboxOperation({
          id: 10,
          timestamp: Date.parse('2026-07-02T09:00:00.000Z'),
          syncContract: {
            mutationId: 'mutation-discharge',
            changedPaths: ['discharges.D1'],
          },
        }),
        makeOutboxOperation({
          id: 11,
          timestamp: Date.parse('2026-07-02T09:05:00.000Z'),
          syncContract: {
            mutationId: 'mutation-discharge',
            changedPaths: ['discharges.D1'],
          },
        }),
      ],
      snapshotRecovery: { status: 'missing', reason: 'save_failed' },
      nowMs: Date.parse('2026-07-02T10:20:00.000Z'),
      staleOutboxMs: 30 * 60 * 1000,
    });

    expect(result.status).toBe('needs_review');
    expect(result.findings.map(finding => finding.type)).toEqual(
      expect.arrayContaining([
        'movement_not_reflected',
        'stale_outbox',
        'repeated_replay',
        'snapshot_missing',
      ])
    );
    expect(
      result.findings.find(finding => finding.type === 'movement_not_reflected')
    ).toMatchObject({
      path: 'discharges.D1',
      module: 'censo',
      affectedPatient: 'Bernardo Orrego',
    });
  });

  it('detects handoff divergence for the same clinical episode', () => {
    const localRecord = makeRecord({
      beds: {
        R1: makePatient('R1', {
          patientName: 'Pierre Jean',
          rut: '25DF52626',
          clinicalEpisodeId: 'episode-pj',
          handoffNoteDayShift: 'Controlar dolor y balance.',
        }),
      },
    });
    const remoteRecord = makeRecord({
      beds: {
        R1: makePatient('R1', {
          patientName: 'Pierre Jean',
          rut: '25DF52626',
          clinicalEpisodeId: 'episode-pj',
          handoffNoteDayShift: 'Sin novedades registradas.',
        }),
      },
    });

    const result = evaluateSyncConvergence({
      localRecord,
      remoteRecord,
      outbox: [],
      snapshotRecovery: { status: 'available' },
      nowMs: Date.parse('2026-07-02T10:20:00.000Z'),
    });

    expect(result.status).toBe('needs_review');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        type: 'handoff_divergent',
        path: 'beds.R1.handoffNoteDayShift',
        module: 'handoff',
        affectedPatient: 'Pierre Jean',
      })
    );
  });
});
