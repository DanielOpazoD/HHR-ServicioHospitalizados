import { describe, expect, it } from 'vitest';
import { DailyRecordPatch, PatientData, PatientStatus, Specialty } from '@/types';
import {
  addClinicalFhirPatchesForTouchedBeds,
  preparePatientForCarryover,
  preserveCIE10FromPreviousDay,
} from '@/services/repositories/dailyRecordClinicalDomainService';

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

describe('dailyRecordClinicalDomainService', () => {
  it('prepares carryover patient by clearing cudyr and inheriting night notes', () => {
    const source = buildPatient('R1', {
      handoffNoteNightShift: 'Nota noche madre',
      medicalHandoffNote: 'Evolucion medica madre',
      medicalHandoffEntries: [
        {
          id: 'entry-1',
          specialty: Specialty.MEDICINA,
          note: 'Paciente estable',
          updatedAt: '2026-03-08T09:15:00.000Z',
          updatedBy: {
            uid: 'doctor-1',
            displayName: 'Dra. Guardia',
            email: 'doctora@hospital.cl',
          },
        },
      ],
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
        medicalHandoffNote: 'Evolucion medica cuna',
      }),
    });

    const carried = preparePatientForCarryover(source);

    expect(carried.cudyr).toBeUndefined();
    expect(carried.handoffNoteDayShift).toBe('Nota noche madre');
    expect(carried.handoffNoteNightShift).toBe('Nota noche madre');
    expect(carried.medicalHandoffNote).toBe('Evolucion medica madre');
    expect(carried.medicalHandoffEntries?.[0]?.note).toBe('Paciente estable');
    expect(carried.medicalHandoffEntries).not.toBe(source.medicalHandoffEntries);
    expect(carried.clinicalCrib?.handoffNoteDayShift).toBe('Nota noche cuna');
    expect(carried.clinicalCrib?.handoffNoteNightShift).toBe('Nota noche cuna');
    expect(carried.clinicalCrib?.medicalHandoffNote).toBe('Evolucion medica cuna');
  });

  it('sanitizes malformed legacy patient data during carryover', () => {
    const source = {
      ...buildPatient('R1'),
      patientName: 'Paciente Legacy',
      status: 'ESTADO_INVALIDO',
      devices: [null, 'CVC'],
      clinicalEvents: [null],
    } as unknown as PatientData;

    const carried = preparePatientForCarryover(source);

    expect(carried.patientName).toBe('Paciente Legacy');
    expect(carried.devices).toEqual([]);
    expect(carried.clinicalEvents).toEqual([]);
    expect(carried.bedId).toBe('R1');
  });

  it('preserves cie10 only when patient names match', () => {
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

  it('adds fhir patches only for touched beds with named patients', () => {
    const mergedPatches: DailyRecordPatch = {
      'beds.R1.patientName': 'Paciente Uno',
      'beds.R2.bedMode': 'Bloqueada',
    };
    const record = {
      beds: {
        R1: buildPatient('R1', {
          patientName: 'Paciente Uno',
          clinicalCrib: buildPatient('C1', { patientName: 'RN Uno' }),
        }),
        R2: buildPatient('R2', { patientName: '' }),
      },
    } as never;

    addClinicalFhirPatchesForTouchedBeds(mergedPatches, record);

    expect(mergedPatches['beds.R1.fhir_resource']).toBeTruthy();
    expect(mergedPatches['beds.R1.clinicalCrib.fhir_resource']).toBeTruthy();
    expect(mergedPatches['beds.R2.fhir_resource']).toBeUndefined();
  });
});
