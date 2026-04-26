import { CHILEAN_HOLIDAYS } from './chileanHolidays';
import { addCalendarDays } from './clinicalDateUtils';

export interface ShiftSchedule {
  dayStart: string;
  dayEnd: string;
  nightStart: string;
  nightEnd: string;
  description: string;
}

export interface ClinicalDayBounds {
  dayStart: string;
  dayStartMinutes: number;
  nextDay: string;
  nightEnd: string;
  nightEndMinutes: number;
}

export const parseTimeMinutes = (value?: string): number | null => {
  if (!value) return null;

  const [hourPart = '', minutePart = ''] = value.trim().split(':');
  const hour = parseInt(hourPart, 10);
  const minute = parseInt(minutePart, 10);

  if (isNaN(hour) || isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
};

export const isBusinessDay = (dateString: string): boolean => {
  if (CHILEAN_HOLIDAYS.includes(dateString)) {
    return false;
  }

  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

export const getNextDay = (dateString: string): string => {
  return addCalendarDays(dateString, 1);
};

export const getPreviousDay = (dateString: string): string => {
  return addCalendarDays(dateString, -1);
};

export const getShiftSchedule = (dateString: string): ShiftSchedule => {
  const todayIsBusinessDay = isBusinessDay(dateString);
  const nextDay = getNextDay(dateString);
  const tomorrowIsBusinessDay = isBusinessDay(nextDay);

  const dayStart = todayIsBusinessDay ? '08:00' : '09:00';
  const dayEnd = '20:00';
  const nightStart = '20:00';
  const nightEnd = tomorrowIsBusinessDay ? '08:00' : '09:00';

  let description = todayIsBusinessDay ? 'Día Hábil' : 'Fin de Semana / Feriado';
  if (todayIsBusinessDay !== tomorrowIsBusinessDay) {
    description += tomorrowIsBusinessDay ? ' → Día Hábil' : ' → No Hábil';
  }

  return {
    dayStart,
    dayEnd,
    nightStart,
    nightEnd,
    description,
  };
};

export const resolveClinicalDayBounds = (recordDate: string): ClinicalDayBounds => {
  const schedule = getShiftSchedule(recordDate);
  const dayStartMinutes = parseTimeMinutes(schedule.dayStart) ?? 8 * 60;
  const nightEndMinutes = parseTimeMinutes(schedule.nightEnd) ?? 8 * 60;

  return {
    dayStart: schedule.dayStart,
    dayStartMinutes,
    nextDay: getNextDay(recordDate),
    nightEnd: schedule.nightEnd,
    nightEndMinutes,
  };
};
