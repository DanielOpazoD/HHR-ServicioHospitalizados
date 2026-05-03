import { describe, expect, it } from 'vitest';
import { resolvePureAdmissionInput } from '@/features/census/controllers/admitPatientGate';
import type { PatientData } from '@/features/census/components/patient-row/patientRowContracts';

describe('resolvePureAdmissionInput', () => {
  it('returns the typed input when only the four admission fields are present', () => {
    const result = resolvePureAdmissionInput({
      patientName: 'Paciente Demo',
      rut: '11.111.111-1',
      admissionDate: '2026-05-03',
      pathology: 'Diagnóstico demo',
    } as Partial<PatientData>);

    expect(result).toEqual({
      patientName: 'Paciente Demo',
      rut: '11.111.111-1',
      admissionDate: '2026-05-03',
      pathology: 'Diagnóstico demo',
    });
  });

  it('returns the typed input when pathology is omitted (still pure admission)', () => {
    const result = resolvePureAdmissionInput({
      patientName: 'Paciente Demo',
      rut: '11.111.111-1',
      admissionDate: '2026-05-03',
    } as Partial<PatientData>);

    expect(result).toEqual({
      patientName: 'Paciente Demo',
      rut: '11.111.111-1',
      admissionDate: '2026-05-03',
      pathology: undefined,
    });
  });

  it('trims whitespace on the required fields', () => {
    const result = resolvePureAdmissionInput({
      patientName: '  Paciente Demo  ',
      rut: '  11.111.111-1  ',
      admissionDate: '  2026-05-03  ',
    } as Partial<PatientData>);

    expect(result?.patientName).toBe('Paciente Demo');
    expect(result?.rut).toBe('11.111.111-1');
    expect(result?.admissionDate).toBe('2026-05-03');
  });

  it.each([
    ['patientName missing', { rut: 'r', admissionDate: 'd' }],
    ['rut missing', { patientName: 'p', admissionDate: 'd' }],
    ['admissionDate missing', { patientName: 'p', rut: 'r' }],
  ])('returns null when %s', (_label, fields) => {
    expect(resolvePureAdmissionInput(fields as Partial<PatientData>)).toBeNull();
  });

  it.each([
    ['empty patientName', { patientName: '', rut: 'r', admissionDate: 'd' }],
    ['whitespace rut', { patientName: 'p', rut: '   ', admissionDate: 'd' }],
    ['empty admissionDate', { patientName: 'p', rut: 'r', admissionDate: '' }],
  ])('returns null when %s', (_label, fields) => {
    expect(resolvePureAdmissionInput(fields as Partial<PatientData>)).toBeNull();
  });

  it('returns null when a non-admission field is present (mixed edit)', () => {
    const result = resolvePureAdmissionInput({
      patientName: 'p',
      rut: 'r',
      admissionDate: 'd',
      bedMode: 'Cama',
    } as unknown as Partial<PatientData>);
    expect(result).toBeNull();
  });

  it('returns null when devices or status are present (mixed edit)', () => {
    const result = resolvePureAdmissionInput({
      patientName: 'p',
      rut: 'r',
      admissionDate: 'd',
      devices: [],
    } as unknown as Partial<PatientData>);
    expect(result).toBeNull();
  });
});
