import { describe, it, expect } from 'vitest';
import {
  resolveDailyRecordConflict,
  resolveDailyRecordConflictWithTrace,
} from '@/services/repositories/conflictResolutionMatrix';
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

  it('prioritizes staffing fields from local during automatic merge', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.nursesDayShift = ['Ana'];

    const local = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    local.nursesDayShift = ['Berta'];

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['nursesDayShift'],
    });

    expect(resolved.nursesDayShift).toEqual(['Berta', 'Ana']);
  });

  it('protects metadata fields from local overwrite during automatic merge', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.schemaVersion = 5;

    const local = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    local.schemaVersion = 1;

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['schemaVersion'],
    });

    expect(resolved.schemaVersion).toBe(5);
  });

  it('prioritizes clinical fields from local during automatic merge', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Remoto',
        pathology: 'Diag remoto',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T09:59:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Local',
        pathology: 'Diag local',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local, { changedPaths: ['*'] });
    expect(resolved.beds.R1.pathology).toBe('Diag local');
    expect(resolved.beds.R1.patientName).toBe('Local');
  });

  it('prioritizes administrative fields from remote during automatic merge', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        bedMode: 'Cama',
        location: 'Habitacion A',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        bedMode: 'Cuna',
        location: 'Pasillo',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local, { changedPaths: ['*'] });
    expect(resolved.beds.R1.bedMode).toBe('Cama');
    expect(resolved.beds.R1.location).toBe('Habitacion A');
  });

  it('returns trace with policy version and per-field decisions', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        pathology: 'Diag remoto',
        location: 'Habitacion A',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        pathology: 'Diag local',
        location: 'Pasillo',
      } as unknown as DailyRecord['beds'][string],
    };

    const result = resolveDailyRecordConflictWithTrace(remote, local, { changedPaths: ['*'] });

    expect(result.trace.policyVersion).toBe('2026-03-v3');
    expect(result.trace.entries.length).toBeGreaterThan(0);
    expect(result.trace.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'beds.R1.pathology',
          strategy: 'scalar_policy',
          winner: 'local',
          reason: 'clinical_local_priority',
        }),
        expect.objectContaining({
          path: 'beds.R1.location',
          strategy: 'scalar_policy',
          winner: 'remote',
          reason: 'admin_remote_priority',
        }),
      ])
    );
  });
});
