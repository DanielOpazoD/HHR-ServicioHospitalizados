import { BEDS } from '@/constants/beds';
import { EVACUATION_METHOD_AEROCARDAL } from '@/constants/clinical';
import { PatientTraceability, SpecialtyTraceabilityType } from '@/types/minsalTypes';
import { normalizeSpecialty, isFachEvacuationMethod } from './normalization';
import type { MinsalDailyRecord } from './minsalRecordContracts';

const resolveTraceabilityDiagnosis = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const diagnosis = value.trim();
  return diagnosis || undefined;
};

/**
 * Build traceability list lazily for a specialty + indicator type.
 */
export function buildSpecialtyTraceability(
  records: MinsalDailyRecord[],
  specialty: string,
  type: SpecialtyTraceabilityType
): PatientTraceability[] {
  if (records.length === 0) return [];

  const normalizedSpecialty = normalizeSpecialty(specialty);
  const dischargeDates = new Map<string, string>();

  records.forEach(record => {
    record.discharges?.forEach(discharge => {
      dischargeDates.set(discharge.rut, record.date);
    });
    record.transfers?.forEach(transfer => {
      dischargeDates.set(transfer.rut, record.date);
    });
  });

  const traceability: PatientTraceability[] = [];

  records.forEach(record => {
    if (type === 'dias-cama') {
      BEDS.forEach(bed => {
        const patient = record.beds[bed.id];
        if (!patient || patient.isBlocked) return;

        if (
          patient.patientName?.trim() &&
          normalizeSpecialty(patient.specialty) === normalizedSpecialty
        ) {
          traceability.push({
            name: patient.patientName,
            rut: patient.rut,
            diagnosis: resolveTraceabilityDiagnosis(patient.pathology),
            date: record.date,
            bedName: patient.bedName,
            admissionDate: patient.admissionDate,
            dischargeDate: dischargeDates.get(patient.rut),
          });
        }

        if (
          patient.clinicalCrib?.patientName?.trim() &&
          normalizeSpecialty(patient.clinicalCrib.specialty) === normalizedSpecialty
        ) {
          traceability.push({
            name: patient.clinicalCrib.patientName,
            rut: patient.clinicalCrib.rut,
            diagnosis: resolveTraceabilityDiagnosis(patient.clinicalCrib.pathology),
            date: record.date,
            bedName: patient.clinicalCrib.bedName ?? patient.bedName,
            admissionDate: patient.clinicalCrib.admissionDate,
            dischargeDate: dischargeDates.get(patient.clinicalCrib.rut),
          });
        }
      });
      return;
    }

    if (type === 'egresos' || type === 'fallecidos') {
      record.discharges?.forEach(discharge => {
        if (normalizeSpecialty(discharge.originalData?.specialty) !== normalizedSpecialty) return;
        if (type === 'fallecidos' && discharge.status !== 'Fallecido') return;

        traceability.push({
          name: discharge.patientName,
          rut: discharge.rut,
          diagnosis: resolveTraceabilityDiagnosis(
            discharge.diagnosis || discharge.originalData?.pathology
          ),
          date: record.date,
          bedName: discharge.bedName,
          admissionDate: discharge.originalData?.admissionDate,
        });
      });
      return;
    }

    record.transfers?.forEach(transfer => {
      if (normalizeSpecialty(transfer.originalData?.specialty) !== normalizedSpecialty) return;
      if (type === 'aerocardal' && transfer.evacuationMethod !== EVACUATION_METHOD_AEROCARDAL)
        return;
      if (type === 'fach' && !isFachEvacuationMethod(transfer.evacuationMethod)) return;

      traceability.push({
        name: transfer.patientName,
        rut: transfer.rut,
        diagnosis: resolveTraceabilityDiagnosis(
          transfer.diagnosis || transfer.originalData?.pathology
        ),
        date: record.date,
        bedName: transfer.bedName,
        admissionDate: transfer.originalData?.admissionDate,
      });
    });
  });

  return traceability;
}
