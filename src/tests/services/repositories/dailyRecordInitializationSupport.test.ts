import { describe, expect, it } from 'vitest';
import { DailyRecord, PatientData, PatientStatus, Specialty } from '@/types';
import {
  buildInitializedDayRecord,
  preparePatientForCarryover,
  preserveCIE10FromPreviousDay,
} from '@/services/repositories/dailyRecordInitializationSupport';

const buildPatient = (bedId: string, overrides: Partial<PatientData> = {}): PatientData => ({
  bedId,
  isBlocked: false,
  bedMode: 'Cama',
  hasCompanionCrib: false,
  patientName: 'Paciente',
  rut: '11.111.111-1',
  age: '40a',
  pathology: 'Diagnostico',
  specialty: Specialty.MEDICINA,
  status: PatientStatus.ESTABLE,
  admissionDate: '2026-02-19',
  hasWristband: false,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
  ...overrides,
});

const buildRecord = (date: string): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: `${date}T08:00:00.000Z`,
    nurses: ['', ''],
    nursesDayShift: ['', ''],
    nursesNightShift: ['', ''],
    tensDayShift: ['', '', ''],
    tensNightShift: ['', '', ''],
    activeExtraBeds: [],
  }) as DailyRecord;

describe('dailyRecordInitializationSupport', () => {
  it('prepares carryover patient by clearing CUDYR and inheriting night notes', () => {
    const source = buildPatient('R1', {
      patientName: 'Madre',
      handoffNoteNightShift: 'Nota noche madre',
      cudyr: {
        changeClothes: 1,
        mobilization: 0,
        feeding: 0,
        elimination: 0,
        psychosocial: 0,
        surveillance: 0,
        vitalSigns: 0,
        fluidBalance: 0,
        oxygenTherapy: 0,
        airway: 0,
        proInterventions: 0,
        skinCare: 0,
        pharmacology: 0,
        invasiveElements: 0,
      },
      clinicalCrib: buildPatient('C1', {
        patientName: 'RN',
        handoffNoteNightShift: 'Nota noche cuna',
      }),
    });

    const carried = preparePatientForCarryover(source);

    expect(carried.cudyr).toBeUndefined();
    expect(carried.handoffNoteDayShift).toBe('Nota noche madre');
    expect(carried.handoffNoteNightShift).toBe('Nota noche madre');
    expect(carried.clinicalCrib?.handoffNoteDayShift).toBe('Nota noche cuna');
    expect(carried.clinicalCrib?.handoffNoteNightShift).toBe('Nota noche cuna');
  });

  it('preserves cie10 only for matching patients by name', () => {
    const newBeds = {
      R1: buildPatient('R1', { patientName: 'Paciente Uno' }),
      R2: buildPatient('R2', { patientName: 'Paciente Dos' }),
    };
    const prevBeds = {
      R1: buildPatient('R1', { patientName: 'Paciente Uno', cie10Code: 'A09' }),
      R2: buildPatient('R2', { patientName: 'Otro Paciente', cie10Code: 'B20' }),
    };

    preserveCIE10FromPreviousDay(newBeds, prevBeds);

    expect(newBeds.R1.cie10Code).toBe('A09');
    expect(newBeds.R2.cie10Code).toBeUndefined();
  });

  it('builds a new day with inherited staffing from previous night shift', () => {
    const previous = buildRecord('2026-02-18');
    previous.nursesNightShift = ['N1', 'N2'];
    previous.tensNightShift = ['T1', 'T2', 'T3'];
    previous.handoffNovedadesNightShift = 'Novedades noche';

    const result = buildInitializedDayRecord('2026-02-19', previous);

    expect(result.dateTimestamp).toBe(Date.parse('2026-02-19T00:00:00'));
    expect(result.nursesDayShift).toEqual(['N1', 'N2']);
    expect(result.tensDayShift).toEqual(['T1', 'T2', 'T3']);
    expect(result.handoffNovedadesDayShift).toBe('Novedades noche');
  });
});
