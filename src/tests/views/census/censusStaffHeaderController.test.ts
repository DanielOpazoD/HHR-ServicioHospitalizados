import { describe, expect, it } from 'vitest';
import {
  collectHospitalizedPatientsForRecord,
  resolveAdmissionsCountForRecord,
  resolveMovementSummaryState,
  resolveStaffSelectorsClassName,
  resolveStaffSelectorsState,
} from '@/features/census/controllers/censusStaffHeaderController';
import { DataFactory } from '@/tests/factories/DataFactory';

describe('censusStaffHeaderController', () => {
  it('normalizes nullable staff arrays to safe arrays', () => {
    expect(resolveStaffSelectorsState(null)).toEqual({
      nursesDayShift: [],
      nursesNightShift: [],
      tensDayShift: [],
      tensNightShift: [],
    });

    expect(
      resolveStaffSelectorsState({
        nursesDayShift: ['A'],
        nursesNightShift: undefined,
        tensDayShift: ['T1', 'T2'],
        tensNightShift: null,
      })
    ).toEqual({
      nursesDayShift: ['A'],
      nursesNightShift: [],
      tensDayShift: ['T1', 'T2'],
      tensNightShift: [],
    });
  });

  it('normalizes movement data and computes cmaCount', () => {
    const result = resolveMovementSummaryState({
      discharges: [DataFactory.createMockDischarge({ id: 'd1' })],
      transfers: [DataFactory.createMockTransfer({ id: 't1' })],
      cma: [DataFactory.createMockCMA({ id: 'c1' }), DataFactory.createMockCMA({ id: 'c2' })],
    });

    expect(result.discharges).toHaveLength(1);
    expect(result.transfers).toHaveLength(1);
    expect(result.cmaCount).toBe(2);
    expect(resolveMovementSummaryState(undefined)).toEqual({
      discharges: [],
      transfers: [],
      cmaCount: 0,
      admissionsCount: 0,
    });
  });

  it('resolves admissions count using clinical day rules', () => {
    const beds = {
      R1: DataFactory.createMockPatient('R1', {
        patientName: 'P1',
        admissionDate: '2026-03-05',
        admissionTime: '12:00',
      }),
      R2: DataFactory.createMockPatient('R2', {
        patientName: 'P2',
        admissionDate: '2026-03-06',
        admissionTime: '07:30',
      }),
      R3: DataFactory.createMockPatient('R3', {
        patientName: 'P3',
        admissionDate: '2026-03-06',
        admissionTime: '08:30',
      }),
    };

    expect(
      resolveAdmissionsCountForRecord({
        beds,
        recordDate: '2026-03-05',
      })
    ).toBe(2);
  });

  it('collects hospitalized patients including valid clinical crib and excluding blocked entries', () => {
    const beds = {
      R1: DataFactory.createMockPatient('R1', {
        patientName: 'Main',
        isBlocked: false,
        clinicalCrib: DataFactory.createMockPatient('R1-crib', {
          patientName: 'Baby',
          isBlocked: false,
        }),
      }),
      R2: DataFactory.createMockPatient('R2', {
        patientName: 'Blocked main',
        isBlocked: true,
      }),
      R3: DataFactory.createMockPatient('R3', {
        patientName: 'Main only',
        isBlocked: false,
        clinicalCrib: DataFactory.createMockPatient('R3-crib', {
          patientName: 'Blocked crib',
          isBlocked: true,
        }),
      }),
    };

    expect(collectHospitalizedPatientsForRecord(beds).map(patient => patient.patientName)).toEqual([
      'Main',
      'Baby',
      'Main only',
    ]);
  });

  it('counts admissions consistently for main beds and clinical crib patients', () => {
    const beds = {
      R1: DataFactory.createMockPatient('R1', {
        patientName: 'Main',
        admissionDate: '2026-03-05',
        admissionTime: '10:00',
        clinicalCrib: DataFactory.createMockPatient('R1-crib', {
          patientName: 'Baby',
          admissionDate: '2026-03-06',
          admissionTime: '07:45',
        }),
      }),
      R2: DataFactory.createMockPatient('R2', {
        patientName: 'Late entry',
        admissionDate: '2026-03-06',
        admissionTime: '08:15',
      }),
    };

    expect(
      resolveAdmissionsCountForRecord({
        beds,
        recordDate: '2026-03-05',
      })
    ).toBe(2);
  });

  it('returns read-only class name only when readOnly is true', () => {
    expect(resolveStaffSelectorsClassName(true)).toBe('pointer-events-none opacity-80');
    expect(resolveStaffSelectorsClassName(false)).toBe('');
  });
});
