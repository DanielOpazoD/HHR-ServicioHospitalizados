import { describe, expect, it } from 'vitest';
import type { DailyRecord, PatientData } from '@/types';
import {
  validateMovePatient,
  validatePatientDischarge,
} from '@/hooks/controllers/validationController';

describe('validationController', () => {
  const record = {
    date: '2026-03-17',
    beds: {
      R1: { bedId: 'R1', patientName: 'Paciente', isBlocked: false } as PatientData,
      R2: { bedId: 'R2', patientName: '', isBlocked: false } as PatientData,
      R3: { bedId: 'R3', patientName: '', isBlocked: true } as PatientData,
    },
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: '2026-03-17T00:00:00.000Z',
    activeExtraBeds: [],
  } as DailyRecord;

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
