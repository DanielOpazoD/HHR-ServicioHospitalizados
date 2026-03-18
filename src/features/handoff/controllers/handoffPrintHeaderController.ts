import type { ShiftSchedule } from '@/utils/dateUtils';

export const resolvePrintableShiftLabel = (
  selectedShift: 'day' | 'night' | undefined,
  schedule: Pick<ShiftSchedule, 'dayStart' | 'dayEnd' | 'nightStart' | 'nightEnd'> | undefined
): string | null => {
  if (!schedule) {
    return null;
  }

  return selectedShift === 'day'
    ? `Turno Largo (${schedule.dayStart} - ${schedule.dayEnd})`
    : `Turno Noche (${schedule.nightStart} - ${schedule.nightEnd})`;
};

export const resolvePrintableStaffList = (
  values: string[] | undefined,
  fallback: string
): { text: string; isFallback: boolean } => {
  const normalized = (values || []).filter(Boolean).join(', ');
  return normalized
    ? { text: normalized, isFallback: false }
    : { text: fallback, isFallback: true };
};
