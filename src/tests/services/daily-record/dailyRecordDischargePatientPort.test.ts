import { describe, expect, it, vi } from 'vitest';
import {
  buildClearedDischargedBed,
  buildDischargePatch,
  createDailyRecordDischargePatientPort,
} from '@/services/daily-record/dailyRecordDischargePatientPort';
import type { DischargePatientInput } from '@/application/daily-record/commands/dischargePatientCommand';

const baseInput: DischargePatientInput = {
  bedId: 'H5C2',
  patientName: 'Paciente Demo',
  rut: '22.222.222-2',
  dischargeStatus: 'Vivo',
  dischargeDate: '2026-05-03',
  recordDate: '2026-05-03',
  actor: 'doctor@hospital.cl',
  preservedLocation: 'Sala 5',
};

describe('buildClearedDischargedBed', () => {
  it('returns a fresh empty patient with the preserved location', () => {
    const cleared = buildClearedDischargedBed(baseInput);

    expect(cleared.bedId).toBe('H5C2');
    expect(cleared.patientName).toBe('');
    expect(cleared.rut).toBe('');
    expect(cleared.location).toBe('Sala 5');
  });

  it('omits the location when not provided', () => {
    const cleared = buildClearedDischargedBed({ ...baseInput, preservedLocation: undefined });
    expect(cleared.bedId).toBe('H5C2');
    expect(cleared.patientName).toBe('');
  });
});

describe('buildDischargePatch', () => {
  it('writes the cleared bed under beds.<bedId>', () => {
    const patch = buildDischargePatch(baseInput) as Record<string, unknown>;

    expect(Object.keys(patch)).toEqual(['beds.H5C2']);
    const cleared = patch['beds.H5C2'] as { bedId: string; patientName: string; location?: string };
    expect(cleared.bedId).toBe('H5C2');
    expect(cleared.patientName).toBe('');
    expect(cleared.location).toBe('Sala 5');
  });
});

describe('createDailyRecordDischargePatientPort', () => {
  it('persists the patch under the recordDate and returns the snapshot', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const port = createDailyRecordDischargePatientPort(persist);

    const snapshot = await port.persistDischarge(baseInput);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('2026-05-03', expect.any(Object));
    expect(snapshot).toEqual({
      bedId: 'H5C2',
      patientName: 'Paciente Demo',
      rut: '22.222.222-2',
      dischargeStatus: 'Vivo',
      dischargeDate: '2026-05-03',
      recordDate: '2026-05-03',
    });
  });

  it('propagates persistence errors verbatim so the command can map them', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('Firestore offline'));
    const port = createDailyRecordDischargePatientPort(persist);

    await expect(port.persistDischarge(baseInput)).rejects.toThrow('Firestore offline');
  });
});
