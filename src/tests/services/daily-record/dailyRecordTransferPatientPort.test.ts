import { describe, expect, it, vi } from 'vitest';
import {
  buildClearedTransferredBed,
  buildTransferPatch,
  createDailyRecordTransferPatientPort,
} from '@/services/daily-record/dailyRecordTransferPatientPort';
import type { TransferPatientInput } from '@/application/daily-record/commands/transferPatientCommand';

const baseInput: TransferPatientInput = {
  bedId: 'H5C2',
  patientName: 'Paciente Demo',
  rut: '22.222.222-2',
  destination: 'Hospital Base de Valdivia',
  transferDate: '2026-05-03',
  recordDate: '2026-05-03',
  actor: 'doctor@hospital.cl',
  preservedLocation: 'Sala 5',
};

describe('buildClearedTransferredBed', () => {
  it('returns a fresh empty patient with the preserved location', () => {
    const cleared = buildClearedTransferredBed(baseInput);

    expect(cleared.bedId).toBe('H5C2');
    expect(cleared.patientName).toBe('');
    expect(cleared.rut).toBe('');
    expect(cleared.location).toBe('Sala 5');
  });

  it('omits the location when not provided', () => {
    const cleared = buildClearedTransferredBed({ ...baseInput, preservedLocation: undefined });
    expect(cleared.bedId).toBe('H5C2');
    expect(cleared.patientName).toBe('');
  });
});

describe('buildTransferPatch', () => {
  it('writes the cleared bed under beds.<bedId>', () => {
    const patch = buildTransferPatch(baseInput) as Record<string, unknown>;

    expect(Object.keys(patch)).toEqual(['beds.H5C2']);
    const cleared = patch['beds.H5C2'] as { bedId: string; patientName: string; location?: string };
    expect(cleared.bedId).toBe('H5C2');
    expect(cleared.patientName).toBe('');
    expect(cleared.location).toBe('Sala 5');
  });
});

describe('createDailyRecordTransferPatientPort', () => {
  it('persists the patch under the recordDate and returns the snapshot', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const port = createDailyRecordTransferPatientPort(persist);

    const snapshot = await port.persistTransfer(baseInput);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('2026-05-03', expect.any(Object));
    expect(snapshot).toEqual({
      bedId: 'H5C2',
      patientName: 'Paciente Demo',
      rut: '22.222.222-2',
      destination: 'Hospital Base de Valdivia',
      transferDate: '2026-05-03',
      recordDate: '2026-05-03',
    });
  });

  it('propagates persistence errors verbatim so the command can map them', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('Firestore offline'));
    const port = createDailyRecordTransferPatientPort(persist);

    await expect(port.persistTransfer(baseInput)).rejects.toThrow('Firestore offline');
  });
});
