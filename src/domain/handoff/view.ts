import type { BedDefinition, Specialty } from '@/types/domain/base';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';

export const resolveInitialMedicalSpecialtyFromSearch = (
  search: string | undefined
): Specialty | 'all' => {
  if (!search) return 'all';
  const rawSpecialty = new URLSearchParams(search).get('specialty');
  if (!rawSpecialty) return 'all';
  return rawSpecialty as Specialty;
};

export const resolveInitialMedicalScopeFromSearch = (
  search: string | undefined
): MedicalHandoffScope => {
  if (!search) return 'all';
  const rawScope = new URLSearchParams(search).get('scope');
  if (rawScope === 'upc' || rawScope === 'no-upc') return rawScope;
  return 'all';
};

export const filterBedsByMedicalScope = (
  visibleBeds: BedDefinition[],
  record: DailyRecord | null,
  isMedical: boolean,
  scope: MedicalHandoffScope
): BedDefinition[] => {
  if (!isMedical || !record) return visibleBeds;
  if (scope === 'upc') {
    return visibleBeds.filter(bed => record.beds[bed.id]?.isUPC);
  }
  if (scope === 'no-upc') {
    return visibleBeds.filter(bed => !record.beds[bed.id]?.isUPC);
  }
  return visibleBeds;
};

export const collectMedicalSpecialties = (
  beds: BedDefinition[],
  record: DailyRecord | null,
  isMedical: boolean
): Specialty[] => {
  if (!isMedical || !record) return [];

  const seen = new Set<string>();
  const specialties: Specialty[] = [];
  beds.forEach(bed => {
    const specialty = record.beds[bed.id]?.specialty;
    if (!specialty || specialty.trim() === '' || seen.has(specialty)) return;
    seen.add(specialty);
    specialties.push(specialty);
  });
  return specialties;
};

export const filterBedsBySelectedMedicalSpecialty = (
  beds: BedDefinition[],
  record: DailyRecord | null,
  isMedical: boolean,
  selectedSpecialty: Specialty | 'all'
): BedDefinition[] => {
  if (!isMedical || !record || selectedSpecialty === 'all') return beds;
  return beds.filter(bed => record.beds[bed.id]?.specialty === selectedSpecialty);
};

export const hasVisibleMedicalPatients = (
  beds: BedDefinition[],
  record: DailyRecord | null,
  shouldShowPatient: (bedId: string) => boolean
): boolean =>
  beds.some(bed => {
    const patient = record?.beds[bed.id];
    return Boolean(patient?.patientName && shouldShowPatient(bed.id));
  });

export const buildMedicalSpecialtyLink = (
  origin: string,
  pathname: string,
  date: string,
  specialty: Specialty | 'all'
): string => {
  const params = new URLSearchParams();
  params.set('module', 'MEDICAL_HANDOFF');
  params.set('date', date);
  if (specialty !== 'all') {
    params.set('specialty', specialty);
  }
  return `${origin}${pathname}?${params.toString()}`;
};

export const buildMedicalHandoffDeepLink = (
  origin: string,
  pathname: string,
  date: string,
  scope: MedicalHandoffScope,
  specialty: Specialty | 'all'
): string => {
  const params = new URLSearchParams();
  params.set('module', 'MEDICAL_HANDOFF');
  params.set('date', date);
  params.set('scope', scope);
  if (specialty !== 'all') {
    params.set('specialty', specialty);
  }
  return `${origin}${pathname}?${params.toString()}`;
};
