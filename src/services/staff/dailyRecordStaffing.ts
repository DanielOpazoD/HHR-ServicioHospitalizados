import type { DailyRecord } from '@/types';

type DailyRecordStaffingCompatShape = Pick<
  DailyRecord,
  'nurses' | 'nurseName' | 'nursesDayShift' | 'nursesNightShift'
>;

const normalizeStaffList = (staff?: string[] | null): string[] =>
  Array.isArray(staff) ? staff.map(value => value?.trim() || '').filter(Boolean) : [];

const toEmptyShiftPair = (staff: string[]): string[] => (staff.length > 0 ? staff : ['', '']);

const resolveLegacyDayShiftNurses = (record: DailyRecord): string[] => {
  const legacy = normalizeStaffList(record.nurses);
  if (legacy.length > 0) {
    return legacy;
  }

  return record.nurseName?.trim() ? [record.nurseName.trim()] : [];
};

export const resolveDayShiftNurses = (record: DailyRecord | null | undefined): string[] => {
  if (!record) return [];
  const canonical = normalizeStaffList(record.nursesDayShift);
  return canonical.length > 0 ? canonical : resolveLegacyDayShiftNurses(record);
};

export const resolveNightShiftNurses = (record: DailyRecord | null | undefined): string[] => {
  if (!record) return [];
  return normalizeStaffList(record.nursesNightShift);
};

export const applyDailyRecordStaffingCompatibility = <T extends DailyRecordStaffingCompatShape>(
  record: T
): T => {
  const compatRecord = record as unknown as DailyRecord;
  const resolvedDayShift = toEmptyShiftPair(resolveDayShiftNurses(compatRecord));
  const resolvedNightShift = toEmptyShiftPair(resolveNightShiftNurses(compatRecord));

  return {
    ...record,
    // Legacy `nurses` is kept only as a compatibility mirror of the canonical day shift field.
    nurses: [...resolvedDayShift],
    nursesDayShift: [...resolvedDayShift],
    nursesNightShift: [...resolvedNightShift],
  };
};

export const resolvePrimaryDayShiftNurse = (
  record: DailyRecord | null | undefined
): string | undefined => resolveDayShiftNurses(record)[0];

export const resolveShiftNurseSignature = (
  record: DailyRecord | null | undefined,
  preferredShift: 'day' | 'night' = 'night'
): string => {
  if (!record) return '';
  const preferred =
    preferredShift === 'night' ? resolveNightShiftNurses(record) : resolveDayShiftNurses(record);
  if (preferred.length > 0) {
    return preferred.join(' / ');
  }

  const fallback =
    preferredShift === 'night' ? resolveDayShiftNurses(record) : resolveNightShiftNurses(record);
  return fallback.join(' / ');
};

export const resolveExportableNursesText = (
  record: DailyRecord | null | undefined,
  separator = ' & '
): string => resolveDayShiftNurses(record).join(separator);
