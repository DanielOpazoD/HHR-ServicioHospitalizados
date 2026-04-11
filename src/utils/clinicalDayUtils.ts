import { CHILEAN_HOLIDAYS } from './chileanHolidays';

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

export const normalizeDateOnly = (value?: string): string | undefined => {
  if (!value) return undefined;
  return value.split('T')[0];
};

const normalizeCalendarDate = (value?: string): string | undefined => {
  if (!value) return undefined;

  const datePart = value.split('T')[0].trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
    const [day, month, year] = datePart.split('-');
    return `${year}-${month}-${day}`;
  }

  return undefined;
};

const parseCalendarDateUtcNoon = (value?: string): number | null => {
  const normalized = normalizeCalendarDate(value);
  if (!normalized) return null;

  const [year, month, day] = normalized.split('-').map(Number);
  if ([year, month, day].some(part => Number.isNaN(part))) {
    return null;
  }

  return Date.UTC(year, month - 1, day, 12, 0, 0);
};

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
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
};

export const getPreviousDay = (dateString: string): string => {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
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

export const resolveClinicalDayForDateTime = (
  eventDate?: string,
  eventTime?: string
): string | undefined => {
  const normalizedEventDate = normalizeDateOnly(eventDate);
  if (!normalizedEventDate) {
    return undefined;
  }

  const eventTimeMinutes = parseTimeMinutes(eventTime);
  if (eventTimeMinutes === null) {
    return normalizedEventDate;
  }

  const { dayStartMinutes } = resolveClinicalDayBounds(normalizedEventDate);
  return eventTimeMinutes < dayStartMinutes
    ? getPreviousDay(normalizedEventDate)
    : normalizedEventDate;
};

export const isNewAdmissionForClinicalDay = (
  recordDate: string,
  admissionDate?: string,
  admissionTime?: string
): boolean => {
  const normalizedRecordDate = normalizeDateOnly(recordDate);
  const normalizedAdmissionDate = normalizeDateOnly(admissionDate);
  if (!normalizedRecordDate || !normalizedAdmissionDate) {
    return false;
  }

  if (parseTimeMinutes(admissionTime) === null) {
    if (normalizedAdmissionDate === normalizedRecordDate) {
      return true;
    }

    const { nextDay } = resolveClinicalDayBounds(normalizedRecordDate);
    return normalizedAdmissionDate === nextDay;
  }

  const clinicalAdmissionDate = resolveClinicalDayForDateTime(
    normalizedAdmissionDate,
    admissionTime
  );
  if (!clinicalAdmissionDate) {
    return false;
  }

  return clinicalAdmissionDate === normalizedRecordDate;
};

export const isAdmittedDuringShift = (
  recordDate: string,
  admissionDate?: string,
  admissionTime?: string,
  shift: 'day' | 'night' = 'day'
): boolean => {
  const normalizedRecordDate = normalizeDateOnly(recordDate);
  const normalizedAdmissionDate = normalizeDateOnly(admissionDate);

  if (!normalizedAdmissionDate || !normalizedRecordDate) return true;
  if (normalizedAdmissionDate < normalizedRecordDate) return true;

  const admissionTimeMinutes = parseTimeMinutes(admissionTime);
  const dayEndMinutes = 20 * 60;
  const { nextDay, nightEndMinutes } = resolveClinicalDayBounds(normalizedRecordDate);

  if (shift === 'day') {
    if (normalizedAdmissionDate === normalizedRecordDate) {
      if (admissionTimeMinutes === null) return true;
      return admissionTimeMinutes < dayEndMinutes;
    }
    return false;
  }

  if (normalizedAdmissionDate === normalizedRecordDate) {
    return true;
  }

  if (normalizedAdmissionDate === nextDay) {
    if (admissionTimeMinutes === null) return true;
    return admissionTimeMinutes < nightEndMinutes;
  }

  return false;
};

export const calculateHospitalizedDays = (
  admissionDate?: string,
  currentDate?: string
): number | null => {
  if (!admissionDate || !currentDate) return null;

  try {
    const cleanAdmission = admissionDate.split('T')[0];
    const cleanCurrent = currentDate.split('T')[0];

    const [aYear, aMonth, aDay] = cleanAdmission.split('-').map(Number);
    const [cYear, cMonth, cDay] = cleanCurrent.split('-').map(Number);

    const start = Date.UTC(aYear, aMonth - 1, aDay, 12, 0, 0);
    const end = Date.UTC(cYear, cMonth - 1, cDay, 12, 0, 0);

    const diffTime = end - start;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays < 1 ? 1 : diffDays;
  } catch {
    return null;
  }
};

/**
 * DEIS/MINSAL discharge stay rule:
 * - difference between discharge date and admission date
 * - same-day admission/discharge counts as 1
 * - invalid chronology is excluded from the indicator (null)
 */
export const calculateDischargeStayDays = (
  admissionDate?: string,
  dischargeDate?: string
): number | null => {
  const start = parseCalendarDateUtcNoon(admissionDate);
  const end = parseCalendarDateUtcNoon(dischargeDate);
  if (start === null || end === null) {
    return null;
  }

  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return null;
  }

  return diffDays === 0 ? 1 : diffDays;
};
