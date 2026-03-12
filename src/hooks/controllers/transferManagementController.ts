import type { PatientData } from '@/types';
import type {
  PatientSnapshot,
  TransferFormData,
  TransferRequest,
  TransferStatus,
} from '@/types/transfers';
import { isClosedTransferStatus } from '@/services/transfers/transferStatusController';

export const buildHospitalizedPatients = (
  beds: Record<string, PatientData> | null | undefined
): { id: string; name: string; bedId: string; diagnosis: string }[] => {
  if (!beds) {
    return [];
  }

  return Object.entries(beds)
    .filter(([, patient]) => patient.patientName && !patient.isBlocked)
    .map(([bedId, patient]) => ({
      id: bedId,
      name: patient.patientName,
      bedId,
      diagnosis: patient.pathology || 'Sin diagnóstico',
    }));
};

export const buildTransferPatientSnapshot = (
  patient: PatientData,
  recordDate: string
): PatientSnapshot => ({
  name: patient.patientName,
  rut: patient.rut || 'Sin RUT',
  age: parseInt(patient.age) || 0,
  birthDate: patient.birthDate,
  sex: patient.biologicalSex === 'Masculino' ? 'M' : 'F',
  diagnosis: patient.pathology || 'Sin diagnóstico',
  secondaryDiagnoses: patient.diagnosisComments ? [patient.diagnosisComments] : undefined,
  admissionDate: patient.admissionDate || recordDate,
});

export const buildCreateTransferPayload = (
  data: TransferFormData,
  patient: PatientData,
  recordDate: string,
  createdBy: string,
  requestDate: string
) => ({
  patientId: data.bedId,
  bedId: data.bedId,
  patientSnapshot: buildTransferPatientSnapshot(patient, recordDate),
  destinationHospital: data.destinationHospital,
  transferReason: data.transferReason,
  requestingDoctor: data.requestingDoctor,
  requiredSpecialty: data.requiredSpecialty,
  requiredBedType: data.requiredBedType,
  observations: data.observations,
  customFields: data.customFields || {},
  status: 'REQUESTED' as const,
  requestDate,
  createdBy,
});

export const resolvePreviousTransferStatus = (transfer: TransferRequest): TransferStatus => {
  const previousChange =
    transfer.statusHistory.length >= 2
      ? transfer.statusHistory[transfer.statusHistory.length - 2]
      : null;
  return previousChange?.to || 'ACCEPTED';
};

export const filterVisibleTransfers = (transfers: TransferRequest[]): TransferRequest[] =>
  transfers.filter(transfer => !transfer.archived);

export const countActiveTransfers = (transfers: TransferRequest[]): number =>
  transfers.filter(transfer => !isClosedTransferStatus(transfer.status)).length;
