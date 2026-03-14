import type { UserRole } from '@/types';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import type { Specialty } from '@/types';

export const SPECIALIST_MEDICAL_HANDOFF_MODE = 'specialist-medical-handoff';

const DEFAULT_SCOPE: MedicalHandoffScope = 'all';
const ALLOWED_SCOPES = new Set<MedicalHandoffScope>(['all', 'upc', 'no-upc']);

export interface SpecialistMedicalHandoffRouteInfo {
  isSpecialistMedicalHandoffMode: boolean;
  date: string | null;
  scope: MedicalHandoffScope;
  specialty: Specialty | 'all';
}

export const resolveSpecialistMedicalHandoffRouteInfo = (
  search: string | undefined
): SpecialistMedicalHandoffRouteInfo => {
  const params = new URLSearchParams(search || '');
  const mode = params.get('mode');
  const rawScope = params.get('scope');
  const rawSpecialty = params.get('specialty');

  return {
    isSpecialistMedicalHandoffMode: mode === SPECIALIST_MEDICAL_HANDOFF_MODE,
    date: params.get('date'),
    scope:
      rawScope && ALLOWED_SCOPES.has(rawScope as MedicalHandoffScope)
        ? (rawScope as MedicalHandoffScope)
        : DEFAULT_SCOPE,
    specialty: (rawSpecialty || 'all') as Specialty | 'all',
  };
};

export const isSpecialistMedicalHandoffMode = (search?: string): boolean =>
  resolveSpecialistMedicalHandoffRouteInfo(
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  ).isSpecialistMedicalHandoffMode;

export const canAccessSpecialistMedicalHandoff = (role: UserRole | undefined): boolean =>
  role === 'doctor_specialist';
