import { describe, expect, it } from 'vitest';
import { Specialty, type BedDefinition, type DailyRecord } from '@/types';
import {
  buildMedicalSpecialistAccessLink,
  buildMedicalSpecialtyLink,
  collectMedicalSpecialties,
  filterBedsByMedicalScope,
  filterBedsBySelectedMedicalSpecialty,
  hasVisibleMedicalPatients,
  resolveInitialMedicalSpecialtyFromSearch,
} from '@/features/handoff/controllers/medicalPatientHandoffViewController';

const BEDS: BedDefinition[] = [
  { id: '1', name: '101', type: 'MEDIA', isCuna: false },
  { id: '2', name: '102', type: 'MEDIA', isCuna: false },
] as BedDefinition[];

const RECORD = {
  date: '2026-03-03',
  beds: {
    '1': {
      patientName: 'Paciente UPC',
      specialty: Specialty.MEDICINA,
      isUPC: true,
    },
    '2': {
      patientName: 'Paciente Sala',
      specialty: Specialty.CIRUGIA,
      isUPC: false,
    },
  },
} as unknown as DailyRecord;

describe('medicalPatientHandoffViewController', () => {
  it('resolves the initial specialty from the URL search string', () => {
    expect(resolveInitialMedicalSpecialtyFromSearch('?specialty=Cirug%C3%ADa')).toBe(
      Specialty.CIRUGIA
    );
    expect(resolveInitialMedicalSpecialtyFromSearch('?module=MEDICAL_HANDOFF')).toBe('all');
  });

  it('filters beds by medical scope and selected specialty', () => {
    const upcBeds = filterBedsByMedicalScope(BEDS, RECORD, true, 'upc');
    const noUpcBeds = filterBedsByMedicalScope(BEDS, RECORD, true, 'no-upc');
    const surgeryBeds = filterBedsBySelectedMedicalSpecialty(BEDS, RECORD, true, Specialty.CIRUGIA);

    expect(upcBeds.map(bed => bed.id)).toEqual(['1']);
    expect(noUpcBeds.map(bed => bed.id)).toEqual(['2']);
    expect(surgeryBeds.map(bed => bed.id)).toEqual(['2']);
  });

  it('collects specialties, detects visible patients, and builds deep links', () => {
    expect(collectMedicalSpecialties(BEDS, RECORD, true)).toEqual([
      Specialty.MEDICINA,
      Specialty.CIRUGIA,
    ]);
    expect(hasVisibleMedicalPatients(BEDS, RECORD, bedId => bedId === '2')).toBe(true);
    expect(
      buildMedicalSpecialtyLink(
        'https://app.hospitalhangaroa.cl',
        '/handoff',
        '2026-03-03',
        Specialty.CIRUGIA
      )
    ).toBe(
      'https://app.hospitalhangaroa.cl/handoff?module=MEDICAL_HANDOFF&date=2026-03-03&specialty=Cirug%C3%ADa'
    );
    expect(
      buildMedicalSpecialistAccessLink(
        'https://app.hospitalhangaroa.cl',
        '/handoff',
        '2026-03-03',
        'upc',
        Specialty.CIRUGIA
      )
    ).toBe(
      'https://app.hospitalhangaroa.cl/handoff?mode=specialist-medical-handoff&date=2026-03-03&scope=upc&specialty=Cirug%C3%ADa'
    );
  });
});
