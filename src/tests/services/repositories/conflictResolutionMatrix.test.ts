import { describe, it, expect } from 'vitest';
import { resolveDailyRecordConflict } from '@/services/repositories/conflictResolutionMatrix';
import { DailyRecord } from '@/types';

const makeRecord = (date: string, lastUpdated: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated,
  nurses: [],
  activeExtraBeds: [],
});

describe('conflictResolutionMatrix', () => {
  it('applies changed path without overwriting unrelated remote fields', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Nombre remoto',
        pathology: 'Diag remoto',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:01:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Nombre local',
        pathology: 'Diag local (stale)',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['beds.R1.patientName'],
    });

    expect(resolved.beds.R1.patientName).toBe('Nombre local');
    expect(resolved.beds.R1.pathology).toBe('Diag remoto');
  });

  it('merges movement arrays by id (union with local override)', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.transfers = [
      { id: 't1', bedId: 'R1', patientName: 'A' },
      { id: 't2', bedId: 'R2', patientName: 'B' },
    ] as unknown as DailyRecord['transfers'];

    const local = makeRecord('2026-02-18', '2026-02-18T10:01:00.000Z');
    local.transfers = [
      { id: 't2', bedId: 'R2', patientName: 'B (local)' },
      { id: 't3', bedId: 'R3', patientName: 'C' },
    ] as unknown as DailyRecord['transfers'];

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['transfers'],
    });

    const ids = resolved.transfers.map(item => item.id);
    expect(ids).toEqual(['t1', 't2', 't3']);
    expect(resolved.transfers.find(item => item.id === 't2')?.patientName).toBe('B (local)');
  });

  it('resolves full-record conflict using newest scalar values and merged arrays', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.nurses = ['Ana'];
    remote.activeExtraBeds = ['Extra-1'];

    const local = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    local.nurses = ['Berta'];
    local.activeExtraBeds = ['Extra-2'];

    const resolved = resolveDailyRecordConflict(remote, local, { changedPaths: ['*'] });

    expect(resolved.lastUpdated).toBe('2026-02-18T10:05:00.000Z');
    expect(resolved.nurses).toEqual(['Berta', 'Ana']);
    expect(resolved.activeExtraBeds).toEqual(['Extra-2', 'Extra-1']);
  });

  it('preserves explicit empty-string clears from local', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.handoffNovedadesDayShift = 'Texto remoto';

    const local = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    local.handoffNovedadesDayShift = '';

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['handoffNovedadesDayShift'],
    });

    expect(resolved.handoffNovedadesDayShift).toBe('');
  });
});
