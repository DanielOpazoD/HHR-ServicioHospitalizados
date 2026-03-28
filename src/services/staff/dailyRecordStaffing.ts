import type { DailyRecord } from '@/types/domain/dailyRecord';

type DailyRecordStaffingCompatShape = Pick<
  DailyRecord,
  'nurses' | 'nurseName' | 'nursesDayShift' | 'nursesNightShift'
>;

type DailyRecordShiftStaffingShape = Pick<
  DailyRecord,
  'nurses' | 'nurseName' | 'nursesDayShift' | 'nursesNightShift'
>;

type DailyRecordUnknownStaffingShape = Record<
  'nurses' | 'nurseName' | 'nursesDayShift' | 'nursesNightShift',
  unknown
>;

const normalizeStaffList = (staff?: string[] | null): string[] =>
  Array.isArray(staff) ? staff.map(value => value?.trim() || '').filter(Boolean) : [];

const toEmptyShiftPair = (staff: string[]): string[] => (staff.length > 0 ? staff : ['', '']);

const resolveLegacyDayShiftNurses = (record: DailyRecordShiftStaffingShape): string[] => {
  const legacy = normalizeStaffList(record.nurses);
  if (legacy.length > 0) {
    return legacy;
  }

  return record.nurseName?.trim() ? [record.nurseName.trim()] : [];
};

export const resolveDayShiftNurses = (
  record: DailyRecordShiftStaffingShape | null | undefined
): string[] => {
  if (!record) return [];
  const canonical = normalizeStaffList(record.nursesDayShift);
  return canonical.length > 0 ? canonical : resolveLegacyDayShiftNurses(record);
};

export const resolveNightShiftNurses = (
  record: DailyRecordShiftStaffingShape | null | undefined
): string[] => {
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

export const buildCompatibleDayShiftStaffingMirror = (
  staff: string[] | null | undefined
): Pick<DailyRecordStaffingCompatShape, 'nurses' | 'nursesDayShift'> => {
  const resolvedDayShift = toEmptyShiftPair(normalizeStaffList(staff));
  return {
    nurses: [...resolvedDayShift],
    nursesDayShift: [...resolvedDayShift],
  };
};

export const normalizeUnknownDailyRecordStaffing = (
  record: Partial<DailyRecordUnknownStaffingShape>,
  ensurePair: (value: unknown) => string[]
): DailyRecordStaffingCompatShape =>
  applyDailyRecordStaffingCompatibility({
    nurses: ensurePair(record.nurses),
    nurseName: typeof record.nurseName === 'string' ? record.nurseName : undefined,
    nursesDayShift: ensurePair(record.nursesDayShift),
    nursesNightShift: ensurePair(record.nursesNightShift),
  });

export const resolvePrimaryDayShiftNurse = (
  record: DailyRecordShiftStaffingShape | null | undefined
): string | undefined => resolveDayShiftNurses(record)[0];

export const hasLegacyDayShiftNurses = (
  record: DailyRecordShiftStaffingShape | null | undefined
): boolean => {
  if (!record) return false;
  return normalizeStaffList(record.nurses).length > 0;
};

export const hasLegacyPrimaryDayShiftNurse = (
  record: DailyRecordShiftStaffingShape | null | undefined
): boolean => {
  if (!record) return false;
  return Boolean(record.nurseName?.trim());
};

export const resolveShiftNurseSignature = (
  record: DailyRecordShiftStaffingShape | null | undefined,
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
  record: DailyRecordShiftStaffingShape | null | undefined,
  separator = ' & '
): string => resolveDayShiftNurses(record).join(separator);

export const resolveHandoffShiftStaff = (
  record:
    | Pick<
        DailyRecord,
        'nurses' | 'nurseName' | 'nursesDayShift' | 'nursesNightShift' | 'handoffNightReceives'
      >
    | null
    | undefined,
  shift: 'day' | 'night'
): { delivers: string[]; receives: string[] } => {
  if (!record) {
    return {
      delivers: [],
      receives: [],
    };
  }

  return {
    delivers: shift === 'day' ? resolveDayShiftNurses(record) : resolveNightShiftNurses(record),
    receives:
      shift === 'day'
        ? resolveNightShiftNurses(record)
        : normalizeStaffList(record.handoffNightReceives),
  };
};
