import { buildMedicalHandoffDeepLink } from '@/domain/handoff/view';
import type { Specialty } from '@/types/domain/base';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';

export interface MedicalSpecialtyFilterChip {
  key: Specialty | 'all';
  label: string;
  isActive: boolean;
}

export const buildMedicalSpecialtyFilterChips = (
  selectedMedicalSpecialty: Specialty | 'all',
  medicalSpecialties: Specialty[]
): MedicalSpecialtyFilterChip[] => [
  {
    key: 'all',
    label: 'Todos',
    isActive: selectedMedicalSpecialty === 'all',
  },
  ...medicalSpecialties.map(specialty => ({
    key: specialty,
    label: specialty,
    isActive: selectedMedicalSpecialty === specialty,
  })),
];

export const resolveMedicalSpecialistLink = (
  origin: string,
  pathname: string,
  recordDate: string,
  scopedMedicalScope: MedicalHandoffScope,
  selectedMedicalSpecialty: Specialty | 'all'
): string =>
  buildMedicalHandoffDeepLink(
    origin,
    pathname,
    recordDate,
    scopedMedicalScope,
    selectedMedicalSpecialty
  );
