import type { BedDefinition, Specialty } from '@/types/domain/base';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import {
  collectMedicalSpecialties,
  filterBedsByMedicalScope,
  filterBedsBySelectedMedicalSpecialty,
  hasVisibleMedicalPatients,
} from '@/domain/handoff/view';
import {
  resolveMedicalHandoffScope,
  resolveScopedMedicalHandoffSentAt,
  resolveScopedMedicalSignature,
} from '@/domain/handoff/scope';

interface ResolveHandoffMedicalScreenStateInput {
  visibleBeds: BedDefinition[];
  record: DailyRecord | null;
  isMedical: boolean;
  medicalScope: MedicalHandoffScope;
  selectedMedicalSpecialty: Specialty | 'all';
  shouldShowPatient: (bedId: string) => boolean;
}

export const resolveHandoffMedicalScreenState = ({
  visibleBeds,
  record,
  isMedical,
  medicalScope,
  selectedMedicalSpecialty,
  shouldShowPatient,
}: ResolveHandoffMedicalScreenStateInput) => {
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
