import type { DailyRecordStaffingState } from '@/types/domain/dailyRecordSlices';
import { resolveDayShiftNurses } from '@/services/staff/dailyRecordStaffing';
import { resolveNightShiftNurses } from '@/services/staff/dailyRecordStaffing';

export interface InheritedDailyRecordStaffing {
  nursesDay: string[];
  nursesNight: string[];
  tensDay: string[];
  tensNight: string[];
}

export const resolveInheritedDailyRecordStaffing = (
  prevRecord: DailyRecordStaffingState | null
): InheritedDailyRecordStaffing => {
  if (!prevRecord) {
    return {
      nursesDay: ['', ''],
      nursesNight: ['', ''],
      tensDay: ['', '', ''],
      tensNight: ['', '', ''],
    };
  }

  const compatibleDayShiftNurses = resolveDayShiftNurses(prevRecord);
  const nightShiftNurses = resolveNightShiftNurses(prevRecord);
  const isNightShiftEmpty = nightShiftNurses.every(n => !n);
  const prevNurses = !isNightShiftEmpty
    ? nightShiftNurses
    : compatibleDayShiftNurses.length > 0
      ? compatibleDayShiftNurses
      : ['', ''];
  const nursesDay = [...(prevNurses || ['', ''])];
  while (nursesDay.length < 2) nursesDay.push('');

  const nightTens = prevRecord.tensNightShift || [];
  const dayTens = prevRecord.tensDayShift || [];
  const isNightTensEmpty = nightTens.every(t => !t);
  const rawTens = !isNightTensEmpty ? nightTens : dayTens;
  const tensDay = [...rawTens];
  while (tensDay.length < 3) tensDay.push('');

  return {
    nursesDay: nursesDay.slice(0, 2),
    nursesNight: ['', ''],
    tensDay: tensDay.slice(0, 3),
    tensNight: ['', '', ''],
  };
};
