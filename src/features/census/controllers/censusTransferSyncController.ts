import { RECEIVING_CENTER_EXTRASYSTEM, RECEIVING_CENTER_OTHER } from '@/constants/clinical';
import type { TransferExecutionInput } from '@/features/census/domain/movements/contracts';
import type { PatientData } from '@/features/census/components/patient-row/patientRowContracts';
import type {
  completeTransferWithResult,
  createTransferRequest,
  getLatestOpenTransferRequestByBedId,
} from '@/services/transfers/transferService';

export const resolveTransferDestinationHospital = (
  receivingCenter: string,
  receivingCenterOther: string
): string => {
  const otherValue = receivingCenterOther.trim();
  if (
    receivingCenter === RECEIVING_CENTER_OTHER ||
    receivingCenter === RECEIVING_CENTER_EXTRASYSTEM
  ) {
    return otherValue || receivingCenter;
  }
  return receivingCenter;
};

export const resolveTransferCurrentDiagnosis = (patient: PatientData): string => {
  const pathology = patient.pathology?.trim();
  if (pathology) {
    return pathology;
  }

  const cie10Description = patient.cie10Description?.trim();
  if (cie10Description) {
    return cie10Description;
  }

  const cie10Code = patient.cie10Code?.trim();
  if (cie10Code) {
    return cie10Code;
  }

  const diagnosisComment = patient.diagnosisComments?.trim();
  if (diagnosisComment) {
    return diagnosisComment;
  }

  return 'Sin diagnóstico';
};

export const buildTransferPatientSnapshot = (patient: PatientData, recordDate: string) => ({
  name: patient.patientName || 'Paciente sin nombre',
  rut: patient.rut || 'Sin RUT',
  age: Number.parseInt(patient.age || '', 10) || 0,
  birthDate: patient.birthDate,
  sex: patient.biologicalSex === 'Masculino' ? ('M' as const) : ('F' as const),
  diagnosis: resolveTransferCurrentDiagnosis(patient),
  secondaryDiagnoses: patient.diagnosisComments ? [patient.diagnosisComments] : undefined,
  admissionDate: patient.admissionDate || recordDate,
});

interface SyncCensusTransferRequestParams {
  bedId: string;
  patient: PatientData;
  recordDate?: string;
  data?: TransferExecutionInput;
  destinationHospital: string;
  createdByEmail: string;
  getLatestOpenTransferRequestByBedId: typeof getLatestOpenTransferRequestByBedId;
  createTransferRequest: typeof createTransferRequest;
  completeTransferWithResult: typeof completeTransferWithResult;
}

export const syncCensusTransferRequest = async ({
  bedId,
  patient,
  recordDate,
  data,
  destinationHospital,
  createdByEmail,
  getLatestOpenTransferRequestByBedId,
  createTransferRequest,
  completeTransferWithResult,
}: SyncCensusTransferRequestParams): Promise<void> => {
  const linkedRequest = await getLatestOpenTransferRequestByBedId(bedId);
  if (linkedRequest) {
    await completeTransferWithResult(linkedRequest.id, createdByEmail);
    return;
  }

  const requestDate = (data?.movementDate || recordDate || new Date().toISOString()).split('T')[0];

  await createTransferRequest({
    patientId: bedId,
    bedId,
    patientSnapshot: buildTransferPatientSnapshot(patient, recordDate || requestDate),
    destinationHospital,
    transferReason: 'Traslado registrado desde Censo Diario',
    requestingDoctor: '',
    observations:
      'Solicitud creada automáticamente desde Censo Diario para completar gestión posterior.',
    customFields: {
      source: 'census_transfer_autocreate',
    },
    status: 'REQUESTED',
    requestDate,
    createdBy: createdByEmail,
  });
};
