import { describe, expect, it, vi } from 'vitest';
import {
  buildAdmitPatientPatch,
  createDailyRecordAdmitPatientPort,
} from '@/services/daily-record/dailyRecordAdmitPatientPort';
import type { AdmitPatientInput } from '@/application/daily-record/commands/admitPatientCommand';

const baseInput = (overrides: Partial<AdmitPatientInput> = {}): AdmitPatientInput => ({
  bedId: 'H5C1',
  patientName: 'Paciente Demo',
  rut: '11.111.111-1',
  pathology: 'Diagnóstico demo',
  admissionDate: '2026-05-03',
  recordDate: '2026-05-03',
  actor: 'nurse@hospital.cl',
  ...overrides,
});

describe('buildAdmitPatientPatch', () => {
  it('emits paths scoped to the target bedId for the four admission fields', () => {
    expect(buildAdmitPatientPatch(baseInput())).toEqual({
      'beds.H5C1.patientName': 'Paciente Demo',
      'beds.H5C1.rut': '11.111.111-1',
      'beds.H5C1.admissionDate': '2026-05-03',
      'beds.H5C1.pathology': 'Diagnóstico demo',
    });
  });

  it('omits pathology when not supplied', () => {
    const patch = buildAdmitPatientPatch(baseInput({ pathology: undefined }));
    expect(patch).toEqual({
      'beds.H5C1.patientName': 'Paciente Demo',
      'beds.H5C1.rut': '11.111.111-1',
      'beds.H5C1.admissionDate': '2026-05-03',
    });
    expect(Object.keys(patch)).not.toContain('beds.H5C1.pathology');
  });

  it('emits an empty pathology string when explicitly cleared', () => {
    const patch = buildAdmitPatientPatch(baseInput({ pathology: '' })) as Record<string, unknown>;
    expect(patch['beds.H5C1.pathology']).toBe('');
  });
});

describe('createDailyRecordAdmitPatientPort', () => {
  it('persists the patch through the injected persistence fn and returns a snapshot of the input', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const port = createDailyRecordAdmitPatientPort(persist);

    const input = baseInput();
    const snapshot = await port.persistAdmission(input);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('2026-05-03', {
      'beds.H5C1.patientName': 'Paciente Demo',
      'beds.H5C1.rut': '11.111.111-1',
      'beds.H5C1.admissionDate': '2026-05-03',
      'beds.H5C1.pathology': 'Diagnóstico demo',
    });
    expect(snapshot).toEqual({
      bedId: 'H5C1',
      patientName: 'Paciente Demo',
      rut: '11.111.111-1',
      admissionDate: '2026-05-03',
      recordDate: '2026-05-03',
    });
  });

  it('lets the persistence error surface to the caller (caught by the command)', async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error('Firestore offline'));
    const port = createDailyRecordAdmitPatientPort(persist);

    await expect(port.persistAdmission(baseInput())).rejects.toThrow('Firestore offline');
  });
});
