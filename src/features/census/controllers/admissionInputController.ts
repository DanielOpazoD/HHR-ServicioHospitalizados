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

export const resolveAdmissionDateIsEditable = ({
  recordDate,
  firstSeenDate,
  hasPatient,
  isNewAdmission,
}: {
  recordDate: string;
  firstSeenDate?: string;
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
