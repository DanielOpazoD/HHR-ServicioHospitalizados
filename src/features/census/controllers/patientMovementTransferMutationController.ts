import { BedDefinition } from '@/types/domain/base';
import { PatientData } from '@/features/census/components/patient-row/patientRowDataContracts';
import { TransferData } from '@/types/domain/movements';
import type { TransferCommandPayload } from '@/features/census/domain/movements/contracts';
import {
  buildClearedBedPatient,
  clonePatientSnapshot,
} from '@/features/census/controllers/patientMovementCreationSharedController';

interface BuildTransferEntriesParams {
  patient: PatientData;
  bedId: string;
  bedDef?: BedDefinition;
  payload: TransferCommandPayload;
  resolvedMovementDate: string;
  createId: () => string;
}

export const buildTransferEntries = ({
  patient,
  bedId,
  bedDef,
  payload,
  resolvedMovementDate,
  createId,
}: BuildTransferEntriesParams): TransferData[] => {
  const {
    evacuationMethod: method,
    receivingCenter: center,
    receivingCenterOther: centerOther,
    transferEscort: escort,
    time,
  } = payload;

  const transfers: TransferData[] = [
    {
      id: createId(),
      movementDate: resolvedMovementDate,
      bedName: bedDef?.name || bedId,
      bedId,
      bedType: bedDef?.type || '',
      patientName: patient.patientName,
      rut: patient.rut,
      diagnosis: patient.pathology,
      time: time || '',
      evacuationMethod: method,
      receivingCenter: center,
      receivingCenterOther: centerOther,
      transferEscort: escort,
      age: patient.age,
      insurance: patient.insurance,
      origin: patient.origin,
      isRapanui: patient.isRapanui,
      originalData: clonePatientSnapshot(patient),
      isNested: false,
    },
  ];

  if (patient.clinicalCrib?.patientName) {
    transfers.push({
      id: createId(),
      movementDate: resolvedMovementDate,
      bedName: `${bedDef?.name || bedId} (Cuna)`,
      bedId,
      bedType: 'Cuna',
      patientName: patient.clinicalCrib.patientName,
      rut: patient.clinicalCrib.rut,
      diagnosis: patient.clinicalCrib.pathology,
      time: time || '',
      evacuationMethod: method,
      receivingCenter: center,
      receivingCenterOther: centerOther,
      transferEscort: escort,
      age: patient.clinicalCrib.age,
      insurance: patient.insurance,
      origin: patient.origin,
      isRapanui: patient.isRapanui,
      originalData: clonePatientSnapshot(patient.clinicalCrib),
      isNested: true,
    });
  }

  return transfers;
};

export const resolveTransferUpdatedBed = ({
  bedId,
  patient,
  createEmptyPatient,
}: {
  bedId: string;
  patient: PatientData;
  createEmptyPatient: (bedId: string) => PatientData;
}): PatientData =>
  buildClearedBedPatient({
    bedId,
    location: patient.location,
    createEmptyPatient,
  });
