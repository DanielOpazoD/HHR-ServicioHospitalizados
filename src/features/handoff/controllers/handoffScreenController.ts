import type { BedDefinition, DailyRecord, Specialty } from '@/types';
import {
  collectMedicalSpecialties,
  filterBedsByMedicalScope,
  filterBedsBySelectedMedicalSpecialty,
  hasVisibleMedicalPatients,
} from './medicalPatientHandoffViewController';
import {
  resolveMedicalHandoffScope,
  resolveScopedMedicalHandoffSentAt,
  resolveScopedMedicalSignature,
  type MedicalHandoffScope,
} from './medicalHandoffScopeController';

interface ResolveHandoffScreenStateInput {
  visibleBeds: BedDefinition[];
  record: DailyRecord | null;
  isMedical: boolean;
  medicalScope: MedicalHandoffScope;
  selectedMedicalSpecialty: Specialty | 'all';
  shouldShowPatient: (bedId: string) => boolean;
}

export const resolveHandoffScreenState = ({
  visibleBeds,
  record,
  isMedical,
  medicalScope,
  selectedMedicalSpecialty,
  shouldShowPatient,
}: ResolveHandoffScreenStateInput) => {
  const scopedMedicalScope = resolveMedicalHandoffScope(medicalScope);
  const filteredMedicalBeds = filterBedsByMedicalScope(
    visibleBeds,
    record,
    isMedical,
    scopedMedicalScope
  );
  const effectiveVisibleBeds = isMedical ? filteredMedicalBeds : visibleBeds;
  const medicalSpecialties = collectMedicalSpecialties(effectiveVisibleBeds, record, isMedical);
  const specialtyFilteredBeds = filterBedsBySelectedMedicalSpecialty(
    effectiveVisibleBeds,
    record,
    isMedical,
    selectedMedicalSpecialty
  );

  return {
    scopedMedicalScope,
    effectiveVisibleBeds,
    medicalSpecialties,
    specialtyFilteredBeds,
    scopedMedicalSignature: isMedical
      ? resolveScopedMedicalSignature(record, scopedMedicalScope)
      : null,
    scopedMedicalHandoffSentAt: isMedical
      ? resolveScopedMedicalHandoffSentAt(record, scopedMedicalScope)
      : null,
    hasAnyVisiblePatients: hasVisibleMedicalPatients(
      specialtyFilteredBeds,
      record,
      shouldShowPatient
    ),
  };
};
