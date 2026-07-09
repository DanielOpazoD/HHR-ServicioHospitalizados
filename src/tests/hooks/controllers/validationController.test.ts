import { describe, expect, it } from 'vitest';
import type { PatientData } from '@/types/domain/patient';
import {
  validateMovePatient,
  validatePatientDischarge,
} from '@/hooks/controllers/validationController';
import {
  createDailyRecordFixture,
  createPatientBedFixture,
} from '@/tests/support/dailyRecordFixtures';

describe('validationController', () => {
  const record = createDailyRecordFixture({
    date: '2026-03-17',
    beds: {
      R1: createPatientBedFixture('R1', { patientName: 'Paciente', isBlocked: false }),
      R2: createPatientBedFixture('R2', { patientName: '', isBlocked: false }),
      R3: createPatientBedFixture('R3', { patientName: '', isBlocked: true }),
    },
    lastUpdated: '2026-03-17T00:00:00.000Z',
  });

  it('validates move target occupancy and blocked state', () => {
    expect(validateMovePatient('R1', record)).toEqual({
      canMove: false,
      reason: 'La cama de destino ya está ocupada',
    });
    expect(validateMovePatient('R3', record)).toEqual({
      canMove: false,
      reason: 'La cama de destino está bloqueada',
    });
    expect(validateMovePatient('R2', record)).toEqual({ canMove: true });
  });

  it('validates minimal discharge readiness', () => {
    expect(
      validatePatientDischarge({
        patientName: 'Paciente',
        admissionDate: '2026-03-17',
      } as PatientData)
    ).toBe(true);
    expect(
      validatePatientDischarge({
        patientName: '',
        admissionDate: '2026-03-17',
      } as PatientData)
    ).toBe(false);
  });
});
