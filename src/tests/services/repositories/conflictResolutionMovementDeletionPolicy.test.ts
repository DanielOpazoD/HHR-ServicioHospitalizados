import { describe, expect, it } from 'vitest';
import { resolveDailyRecordConflict } from '@/services/repositories/conflictResolutionMatrix';
import type { DailyRecord } from '@/types/domain/dailyRecord';

const makeRecord = (lastUpdated: string): DailyRecord =>
  ({
    date: '2026-02-18',
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    nurses: [],
    activeExtraBeds: [],
    lastUpdated,
  }) as DailyRecord;

describe('conflict resolution movement deletion policy', () => {
  it('does not resurrect a movement removed from a newer remote snapshot during whole-record merge', () => {
    const remote = makeRecord('2026-02-18T10:05:00.000Z');
    remote.discharges = [];
    remote.transfers = [];
    remote.cma = [];

    const local = makeRecord('2026-02-18T10:00:00.000Z');
    local.discharges = [
      {
        id: 'discharge-deleted-remotely',
        bedId: 'R1',
        patientName: 'Paciente Alta',
      },
    ] as unknown as DailyRecord['discharges'];
    local.transfers = [
      {
        id: 'transfer-deleted-remotely',
        bedId: 'R2',
        patientName: 'Paciente Traslado',
      },
    ] as unknown as DailyRecord['transfers'];
    local.cma = [
      {
        id: 'cma-deleted-remotely',
        bedName: 'R3',
        patientName: 'Paciente CMA',
      },
    ] as unknown as DailyRecord['cma'];

    const resolved = resolveDailyRecordConflict(remote, local);

    expect(resolved.discharges).toEqual([]);
    expect(resolved.transfers).toEqual([]);
    expect(resolved.cma).toEqual([]);
  });

  it('keeps explicit local movement edits in changed-path merges', () => {
    const remote = makeRecord('2026-02-18T10:05:00.000Z');
    remote.discharges = [
      {
        id: 'd1',
        bedId: 'R1',
        patientName: 'Paciente Remoto',
      },
    ] as unknown as DailyRecord['discharges'];

    const local = makeRecord('2026-02-18T10:00:00.000Z');
    local.discharges = [
      {
        id: 'd1',
        bedId: 'R1',
        patientName: 'Paciente Editado Local',
      },
    ] as unknown as DailyRecord['discharges'];

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['discharges'],
    });

    expect(resolved.discharges).toHaveLength(1);
    expect(resolved.discharges[0].patientName).toBe('Paciente Editado Local');
  });
});
