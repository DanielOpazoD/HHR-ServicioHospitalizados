import { describe, expect, it } from 'vitest';
import { evaluateDailyRecordConflictPostMergeInvariants } from '@/services/repositories/dailyRecordConflictPostMergeInvariantChecker';
import type { DailyRecord } from '@/types/domain/dailyRecord';

const makeRecord = (lastUpdated: string): DailyRecord =>
  ({
    date: '2026-07-01',
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    nurses: [],
    activeExtraBeds: [],
    lastUpdated,
  }) as DailyRecord;

describe('dailyRecordConflictPostMergeInvariantChecker', () => {
  it('blocks post-merge records that drop visible movements, revive tombstones or duplicate active patients', () => {
    const remote = makeRecord('2026-07-01T10:10:00.000Z');
    remote.discharges = [
      { id: 'discharge-remote', bedId: 'R1', patientName: 'Alta remota' },
      {
        id: 'discharge-deleted',
        bedId: 'R2',
        patientName: 'Alta eliminada',
        deletedAt: '2026-07-01T10:09:00.000Z',
      },
    ] as unknown as DailyRecord['discharges'];
    remote.transfers = [
      { id: 'transfer-remote', bedId: 'R3', patientName: 'Traslado remoto' },
    ] as unknown as DailyRecord['transfers'];
    remote.cma = [
      {
        id: 'cma-remote',
        bedName: 'R4',
        originalBedId: 'R4',
        patientName: 'CMA remoto',
      },
    ] as unknown as DailyRecord['cma'];

    const local = makeRecord('2026-07-01T10:00:00.000Z');
    local.discharges = [
      { id: 'discharge-local', bedId: 'R5', patientName: 'Alta local' },
      { id: 'discharge-deleted', bedId: 'R2', patientName: 'Alta eliminada revivida' },
    ] as unknown as DailyRecord['discharges'];
    local.transfers = [
      { id: 'transfer-local', bedId: 'R6', patientName: 'Traslado local' },
    ] as unknown as DailyRecord['transfers'];
    local.cma = [
      {
        id: 'cma-local',
        bedName: 'R7',
        originalBedId: 'R7',
        patientName: 'CMA local',
      },
    ] as unknown as DailyRecord['cma'];

    const resolved = makeRecord('2026-07-01T10:10:00.000Z');
    resolved.beds = {
      R8: {
        bedId: 'R8',
        patientName: 'Paciente duplicado',
        rut: '12.345.678-9',
      } as unknown as DailyRecord['beds'][string],
      R9: {
        bedId: 'R9',
        patientName: 'Paciente duplicado',
        rut: '12.345.678-9',
      } as unknown as DailyRecord['beds'][string],
    };
    resolved.discharges = [
      { id: 'discharge-local', bedId: 'R5', patientName: 'Alta local' },
      { id: 'discharge-deleted', bedId: 'R2', patientName: 'Alta eliminada revivida' },
    ] as unknown as DailyRecord['discharges'];
    resolved.transfers = [
      { id: 'transfer-remote', bedId: 'R3', patientName: 'Traslado remoto' },
    ] as unknown as DailyRecord['transfers'];
    resolved.cma = [
      {
        id: 'cma-local',
        bedName: 'R7',
        originalBedId: 'R7',
        patientName: 'CMA local',
      },
    ] as unknown as DailyRecord['cma'];

    const result = evaluateDailyRecordConflictPostMergeInvariants({
      remote,
      local,
      resolved,
      context: { date: '2026-07-01', phase: 'sync_publish' },
    });

    expect(result.status).toBe('blocked');
    expect(result.violations.map(violation => violation.type)).toEqual(
      expect.arrayContaining([
        'movement_missing_after_merge',
        'movement_tombstone_revived',
        'duplicate_active_patient_after_merge',
      ])
    );
    expect(result.violations.map(violation => violation.path)).toEqual(
      expect.arrayContaining([
        'discharges.discharge-remote',
        'transfers.transfer-local',
        'cma.cma-remote',
        'discharges.discharge-deleted',
        'beds.R9',
      ])
    );
  });

  it('accepts safe merged movement unions with dominant tombstones and no duplicate active patient', () => {
    const remote = makeRecord('2026-07-01T10:10:00.000Z');
    remote.discharges = [
      {
        id: 'discharge-deleted',
        bedId: 'R2',
        patientName: 'Alta eliminada',
        deletedAt: '2026-07-01T10:09:00.000Z',
      },
    ] as unknown as DailyRecord['discharges'];

    const local = makeRecord('2026-07-01T10:00:00.000Z');
    local.discharges = [
      { id: 'discharge-local', bedId: 'R5', patientName: 'Alta local' },
      { id: 'discharge-deleted', bedId: 'R2', patientName: 'Alta eliminada revivida' },
    ] as unknown as DailyRecord['discharges'];

    const resolved = makeRecord('2026-07-01T10:10:00.000Z');
    resolved.discharges = [
      {
        id: 'discharge-deleted',
        bedId: 'R2',
        patientName: 'Alta eliminada',
        deletedAt: '2026-07-01T10:09:00.000Z',
      },
      { id: 'discharge-local', bedId: 'R5', patientName: 'Alta local' },
    ] as unknown as DailyRecord['discharges'];

    const result = evaluateDailyRecordConflictPostMergeInvariants({
      remote,
      local,
      resolved,
      context: { date: '2026-07-01', phase: 'sync_publish' },
    });

    expect(result).toMatchObject({
      status: 'ok',
      violations: [],
    });
    expect(result.record).toBe(resolved);
  });
});
