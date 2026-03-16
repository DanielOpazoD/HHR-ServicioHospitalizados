import { describe, expect, it } from 'vitest';
import type { BedDefinition, DailyRecord } from '@/types';
import { Specialty } from '@/types';
import { resolveHandoffMedicalScreenState } from '@/application/handoff';

const BEDS: BedDefinition[] = [
  { id: 'R1', name: '101', type: 'MEDIA', isCuna: false },
  { id: 'R2', name: '102', type: 'MEDIA', isCuna: false },
] as BedDefinition[];

const RECORD = {
  date: '2026-03-03',
  beds: {
    R1: { patientName: 'UPC', specialty: Specialty.MEDICINA, isUPC: true },
    R2: { patientName: 'Sala', specialty: Specialty.CIRUGIA, isUPC: false },
  },
  medicalSignatureByScope: {
    upc: { doctorName: 'Dr. UPC', signedAt: '2026-03-03T10:00:00.000Z' },
  },
  medicalHandoffSentAtByScope: {
    upc: '2026-03-03T10:30:00.000Z',
  },
} as unknown as DailyRecord;

describe('handoff screen read model', () => {
  it('resolves scoped medical screen state in one place', () => {
    const state = resolveHandoffMedicalScreenState({
      visibleBeds: BEDS,
      record: RECORD,
      isMedical: true,
      medicalScope: 'upc',
      selectedMedicalSpecialty: Specialty.MEDICINA,
      shouldShowPatient: () => true,
    });

    expect(state.scopedMedicalScope).toBe('upc');
    expect(state.effectiveVisibleBeds.map(bed => bed.id)).toEqual(['R1']);
    expect(state.specialtyFilteredBeds.map(bed => bed.id)).toEqual(['R1']);
    expect(state.scopedMedicalSignature?.doctorName).toBe('Dr. UPC');
    expect(state.scopedMedicalHandoffSentAt).toBe('2026-03-03T10:30:00.000Z');
    expect(state.hasAnyVisiblePatients).toBe(true);
  });
});
