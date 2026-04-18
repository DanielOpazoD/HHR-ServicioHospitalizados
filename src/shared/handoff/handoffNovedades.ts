import type { ShiftType } from '@/types/domain/shift';

export const resolveNursingHandoffNovedadesText = ({
  selectedShift,
  handoffNovedadesDayShift,
  handoffNovedadesNightShift,
}: {
  selectedShift: ShiftType;
  handoffNovedadesDayShift?: string;
  handoffNovedadesNightShift?: string;
}): string => {
  if (selectedShift === 'day') {
    return handoffNovedadesDayShift || '';
  }

  return handoffNovedadesNightShift || handoffNovedadesDayShift || '';
};
