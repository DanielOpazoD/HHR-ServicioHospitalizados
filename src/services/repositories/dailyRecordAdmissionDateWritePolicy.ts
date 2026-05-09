import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import {
  AdmissionDatePolicyViolationError,
  resolveAdmissionDateMutationViolation,
  resolveAdmissionDateWindowViolation,
} from '@/application/patient-flow/admissionDatePolicy';
import { normalizeDateOnly } from '@/utils/clinicalDayUtils';

interface RecordPatientEntry {
  path: string;
  patient: PatientData;
}

const normalizeRutKey = (rut?: string): string =>
  (rut || '')
    .replace(/[.\-\s]/g, '')
    .trim()
    .toUpperCase();

const hasPatientIdentity = (patient?: PatientData): patient is PatientData =>
  Boolean(patient?.patientName?.trim() && patient?.rut?.trim());

const hasStableAdmissionAnchor = (
  currentPatient?: PatientData,
  nextPatient?: PatientData
): boolean =>
  normalizeDateOnly(currentPatient?.admissionDate) ===
    normalizeDateOnly(nextPatient?.admissionDate) &&
  normalizeDateOnly(currentPatient?.firstSeenDate) ===
    normalizeDateOnly(nextPatient?.firstSeenDate);

const collectRecordPatients = (record: DailyRecord): RecordPatientEntry[] => {
  const entries: RecordPatientEntry[] = [];

  Object.entries(record.beds || {}).forEach(([bedId, patient]) => {
    if (hasPatientIdentity(patient)) {
      entries.push({ path: `beds.${bedId}`, patient });
    }

    if (hasPatientIdentity(patient.clinicalCrib)) {
      entries.push({ path: `beds.${bedId}.clinicalCrib`, patient: patient.clinicalCrib });
    }
  });

  return entries;
};

export const assertAdmissionDatePersistencePolicy = (
  date: string,
  nextRecord: DailyRecord,
  previousRecord?: DailyRecord | null
): void => {
  const nextEntries = collectRecordPatients(nextRecord);
  const previousByRut = new Map<string, RecordPatientEntry>();

  if (previousRecord) {
    collectRecordPatients(previousRecord).forEach(entry => {
      const rutKey = normalizeRutKey(entry.patient.rut);
      if (rutKey && !previousByRut.has(rutKey)) {
        previousByRut.set(rutKey, entry);
      }
    });
  }

  const violations = nextEntries
    .map(entry => {
      const rutKey = normalizeRutKey(entry.patient.rut);
      const currentEntry = rutKey ? previousByRut.get(rutKey) : undefined;
      if (currentEntry && hasStableAdmissionAnchor(currentEntry.patient, entry.patient)) {
        return null;
      }

      return resolveAdmissionDateWindowViolation({
        recordDate: date,
        path: entry.path,
        patient: entry.patient,
      });
    })
    .filter((violation): violation is NonNullable<typeof violation> => Boolean(violation));

  if (previousRecord) {
    nextEntries.forEach(entry => {
      const rutKey = normalizeRutKey(entry.patient.rut);
      const currentEntry = rutKey ? previousByRut.get(rutKey) : undefined;
      const mutationViolation = resolveAdmissionDateMutationViolation({
        recordDate: date,
        path: entry.path,
        currentPatient: currentEntry?.patient,
        nextPatient: entry.patient,
      });
      if (mutationViolation) {
        violations.push(mutationViolation);
      }
    });
  }

  if (violations.length === 0) {
    return;
  }

  const [firstViolation] = violations;
  throw new AdmissionDatePolicyViolationError(
    `${firstViolation.message} (${firstViolation.patientName} · ${firstViolation.rut})`,
    violations
  );
};
