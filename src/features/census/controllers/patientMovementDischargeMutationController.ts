import { BedDefinition } from '@/types/domain/base';
import { DischargeData, DischargeType } from '@/types/domain/movements';
import { PatientData } from '@/features/census/components/patient-row/patientRowDataContracts';
import type { DischargeAddCommandPayload } from '@/features/census/domain/movements/contracts';
import {
  buildClearedBedPatient,
  clonePatientSnapshot,
  type MovementAuditEntry,
} from '@/features/census/controllers/patientMovementCreationSharedController';

interface BuildDischargeEntriesParams {
  patient: PatientData;
  bedId: string;
  bedDef?: BedDefinition;
  payload: DischargeAddCommandPayload;
  resolvedMovementDate: string;
  createId: () => string;
}

export const buildDischargeEntries = ({
  patient,
  bedId,
  bedDef,
  payload,
  resolvedMovementDate,
  createId,
}: BuildDischargeEntriesParams): {
  discharges: DischargeData[];
  auditEntries: MovementAuditEntry[];
} => {
  const {
    status,
    cribStatus,
    type: dischargeType,
    typeOther: dischargeTypeOther,
    time,
    dischargeTarget: target = 'both',
  } = payload;
  const discharges: DischargeData[] = [];
  const auditEntries: MovementAuditEntry[] = [];

  if (target === 'mother' || target === 'both') {
    discharges.push({
      id: createId(),
      movementDate: resolvedMovementDate,
      bedName: bedDef?.name || bedId,
      bedId,
      bedType: bedDef?.type || '',
      patientName: patient.patientName,
      rut: patient.rut,
      diagnosis: patient.pathology,
      time: time || '',
      status,
      dischargeType: status === 'Vivo' ? (dischargeType as DischargeType) : undefined,
      dischargeTypeOther: dischargeType === 'Otra' ? dischargeTypeOther : undefined,
      age: patient.age,
      insurance: patient.insurance,
      origin: patient.origin,
      isRapanui: patient.isRapanui,
      originalData: clonePatientSnapshot(patient),
      isNested: false,
    });
    auditEntries.push({
      bedId,
      patientName: patient.patientName,
      rut: patient.rut,
      status,
    });
  }

  if ((target === 'baby' || target === 'both') && patient.clinicalCrib?.patientName && cribStatus) {
    discharges.push({
      id: createId(),
      movementDate: resolvedMovementDate,
      bedName: `${bedDef?.name || bedId} (Cuna)`,
      bedId,
      bedType: 'Cuna',
      patientName: patient.clinicalCrib.patientName,
      rut: patient.clinicalCrib.rut,
      diagnosis: patient.clinicalCrib.pathology,
      time: time || '',
      status: cribStatus,
      age: patient.clinicalCrib.age,
      insurance: patient.insurance,
      origin: patient.origin,
      isRapanui: patient.isRapanui,
      originalData: clonePatientSnapshot(patient.clinicalCrib),
      isNested: true,
    });
    auditEntries.push({
      bedId,
      patientName: patient.clinicalCrib.patientName,
      rut: patient.clinicalCrib.rut,
      status: cribStatus,
    });
  }

  return {
    discharges,
    auditEntries,
  };
};

interface ResolveDischargeUpdatedBedParams {
  patient: PatientData;
  bedId: string;
  target?: DischargeAddCommandPayload['dischargeTarget'];
  createEmptyPatient: (bedId: string) => PatientData;
}

export const resolveDischargeUpdatedBed = ({
  patient,
  bedId,
  target = 'both',
  createEmptyPatient,
}: ResolveDischargeUpdatedBedParams): PatientData => {
  if (target === 'both') {
    return buildClearedBedPatient({
      bedId,
      location: patient.location,
      createEmptyPatient,
    });
  }

  if (target === 'mother') {
    if (patient.clinicalCrib?.patientName) {
      return {
        ...createEmptyPatient(bedId),
        ...patient.clinicalCrib,
        location: patient.location,
        bedMode: 'Cuna',
        clinicalCrib: undefined,
        hasCompanionCrib: false,
      };
    }

    return buildClearedBedPatient({
      bedId,
      location: patient.location,
      createEmptyPatient,
    });
  }

  return {
    ...patient,
    clinicalCrib: undefined,
  };
};
