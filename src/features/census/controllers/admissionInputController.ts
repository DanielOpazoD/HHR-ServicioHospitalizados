import { getTodayISO } from '@/utils/dateFormattingUtils';
import { getNextDay, getPreviousDay, normalizeDateOnly } from '@/utils/clinicalDayUtils';
import {
  resolveAdmissionDateAudit as resolveAdmissionDateAuditPolicy,
  type AdmissionDateAuditResolution,
} from '@/application/patient-flow/admissionDatePolicy';

export interface AdmissionDateChangeResolution {
  admissionDate: string;
  admissionTime?: string;
  shouldPatchMultiple: boolean;
}

export interface AdmissionDateOption {
  value: string;
  label: string;
  isFallbackValue?: boolean;
}

const formatTimeHHMM = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const resolveAdmissionDateMax = (todayIso: string = getTodayISO()): string => todayIso;

const formatAdmissionDateOptionLabel = (value: string) => {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

export const resolveAllowedAdmissionDates = (recordDate: string): string[] => {
  const normalizedRecordDate = normalizeDateOnly(recordDate);
  if (!normalizedRecordDate) {
    return [];
  }

  return [
    getPreviousDay(normalizedRecordDate),
    normalizedRecordDate,
    getNextDay(normalizedRecordDate),
  ];
};

export const resolveAdmissionDateOptions = (
  recordDate: string,
  admissionDate?: string
): AdmissionDateOption[] => {
  const allowedDates = resolveAllowedAdmissionDates(recordDate);
  const options: AdmissionDateOption[] = allowedDates.map(value => ({
    value,
    label: formatAdmissionDateOptionLabel(value),
  }));

  const normalizedAdmissionDate = normalizeDateOnly(admissionDate);
  if (normalizedAdmissionDate && !allowedDates.includes(normalizedAdmissionDate)) {
    options.unshift({
      value: normalizedAdmissionDate,
      label: formatAdmissionDateOptionLabel(normalizedAdmissionDate),
      isFallbackValue: true,
    });
  }

  return options;
};

export const resolveIsCriticalAdmissionEmpty = (
  patientName?: string,
  admissionDate?: string
): boolean => Boolean(patientName) && !admissionDate;

/**
 * Determines whether the admission date input is editable on a given census day.
 *
 * Editability rules (in priority order):
 *  1. No patient in bed → **not editable**
 *  2. `firstSeenDate` matches `recordDate` → **editable** (modern patients)
 *  3. `firstSeenDate` set but doesn't match → **not editable** (past admission)
 *  4. No `firstSeenDate` but `admissionDate` matches `recordDate` → **editable**
 *     (legacy fallback — patients created before `firstSeenDate` existed)
 *  5. None of the above → falls back to `isNewAdmission` flag
 *
 * @example
 * // Modern patient on admission day
 * resolveAdmissionDateIsEditable({
 *   recordDate: '2026-04-10', firstSeenDate: '2026-04-10',
 *   hasPatient: true, isNewAdmission: true
 * }); // → true
 *
 * // Legacy patient on admission day (no firstSeenDate)
 * resolveAdmissionDateIsEditable({
 *   recordDate: '2026-04-10', admissionDate: '2026-04-10',
 *   hasPatient: true, isNewAdmission: false
 * }); // → true (admissionDate fallback)
 *
 * // Any patient on day after admission
 * resolveAdmissionDateIsEditable({
 *   recordDate: '2026-04-11', firstSeenDate: '2026-04-10',
 *   hasPatient: true, isNewAdmission: false
 * }); // → false
 */
export const resolveAdmissionDateIsEditable = ({
  recordDate,
  firstSeenDate,
  admissionDate,
  hasPatient,
  isNewAdmission,
}: {
  recordDate: string;
  firstSeenDate?: string;
  /** Fallback when firstSeenDate is not set (legacy patients). */
  admissionDate?: string;
  hasPatient?: boolean;
  isNewAdmission: boolean;
}): boolean => {
  const normalizedRecordDate = normalizeDateOnly(recordDate);
  const normalizedFirstSeenDate = normalizeDateOnly(firstSeenDate);

  if (!hasPatient) {
    return false;
  }

  if (normalizedRecordDate && normalizedFirstSeenDate) {
    return normalizedRecordDate === normalizedFirstSeenDate;
  }

  // Legacy fallback: if firstSeenDate is not set but admissionDate matches
  // the record date, the patient was admitted on this day and should be editable.
  const normalizedAdmissionDate = normalizeDateOnly(admissionDate);
  if (normalizedRecordDate && normalizedAdmissionDate) {
    return normalizedRecordDate === normalizedAdmissionDate;
  }

  return isNewAdmission;
};

export const resolveAdmissionDateChange = ({
  nextDate,
  currentAdmissionTime,
  now = new Date(),
}: {
  nextDate: string;
  currentAdmissionTime?: string;
  now?: Date;
}): AdmissionDateChangeResolution => {
  if (nextDate && !currentAdmissionTime) {
    return {
      admissionDate: nextDate,
      admissionTime: formatTimeHHMM(now),
      shouldPatchMultiple: true,
    };
  }

  return {
    admissionDate: nextDate,
    shouldPatchMultiple: false,
  };
};

export const resolveAdmissionDateAudit = ({
  recordDate,
  admissionDate,
  admissionTime,
  firstSeenDate,
}: {
  recordDate: string;
  admissionDate?: string;
  admissionTime?: string;
  firstSeenDate?: string;
}): AdmissionDateAuditResolution =>
  resolveAdmissionDateAuditPolicy({ recordDate, admissionDate, admissionTime, firstSeenDate });
