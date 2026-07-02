import { describe, expect, it } from 'vitest';
import { resolveDailyRecordConflict } from '@/services/repositories/conflictResolutionMatrix';
import type { DailyRecord } from '@/types/domain/dailyRecord';

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

describe('conflictResolutionMatrix census movement policies', () => {
  it('preserves diagnosis when an explicit bed move merges over an empty remote target bed', () => {
    const remote = makeRecord('2026-07-01', '2026-07-01T13:00:00.000Z');
    remote.beds = {
      H2C1: {
        bedId: 'H2C1',
        patientName: 'Pierre-jean',
        rut: '25DF52626',
        admissionDate: '2026-06-29',
        pathology: 'Celulitis pie izquierdo',
        location: 'Sala Hospitalizados',
      } as unknown as DailyRecord['beds'][string],
      H2C2: {
        bedId: 'H2C2',
        patientName: '',
        rut: '',
        pathology: '',
        location: 'Sala Hospitalizados',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-07-01', '2026-07-01T13:05:00.000Z');
    local.beds = {
      H2C1: {
        bedId: 'H2C1',
        patientName: '',
        rut: '',
        pathology: '',
        location: 'Sala Hospitalizados',
      } as unknown as DailyRecord['beds'][string],
      H2C2: {
        bedId: 'H2C2',
        patientName: 'Pierre-jean',
        rut: '25DF52626',
        admissionDate: '2026-06-29',
        pathology: 'Celulitis pie izquierdo',
        location: 'Sala Hospitalizados',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['beds.H2C1', 'beds.H2C2'],
    });

    expect(resolved.beds.H2C2.patientName).toBe('Pierre-jean');
    expect(resolved.beds.H2C2.rut).toBe('25DF52626');
    expect(resolved.beds.H2C2.pathology).toBe('Celulitis pie izquierdo');
    expect(resolved.beds.H2C1.patientName).toBe('');
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
});
