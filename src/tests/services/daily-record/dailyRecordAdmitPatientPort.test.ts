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
    expect(buildAdmitPatientPatch(baseInput({ clinicalEpisodeId: 'ep-admission' }))).toEqual({
      'beds.H5C1.patientName': 'Paciente Demo',
      'beds.H5C1.rut': '11.111.111-1',
      'beds.H5C1.admissionDate': '2026-05-03',
      'beds.H5C1.pathology': 'Diagnóstico demo',
      'beds.H5C1.clinicalEpisodeId': 'ep-admission',
    });
  });

  it('omits pathology when not supplied', () => {
    const patch = buildAdmitPatientPatch(baseInput({ pathology: undefined }));
    expect(patch).toMatchObject({
      'beds.H5C1.patientName': 'Paciente Demo',
      'beds.H5C1.rut': '11.111.111-1',
      'beds.H5C1.admissionDate': '2026-05-03',
      'beds.H5C1.clinicalEpisodeId': expect.stringMatching(/^ep_/),
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
      'beds.H5C1.clinicalEpisodeId': expect.stringMatching(/^ep_/),
    });
    expect(snapshot).toEqual({
      bedId: 'H5C1',
      patientName: 'Paciente Demo',
      rut: '11.111.111-1',
      admissionDate: '2026-05-03',
      recordDate: '2026-05-03',
      clinicalEpisodeId: expect.stringMatching(/^ep_/),
    });
    const persistedPatch = persist.mock.calls[0][1] as Record<string, unknown>;
    expect(snapshot.clinicalEpisodeId).toBe(persistedPatch['beds.H5C1.clinicalEpisodeId']);
  });

  it('lets the persistence error surface to the caller (caught by the command)', async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error('Firestore offline'));
    const port = createDailyRecordAdmitPatientPort(persist);

    await expect(port.persistAdmission(baseInput())).rejects.toThrow('Firestore offline');
  });
});
