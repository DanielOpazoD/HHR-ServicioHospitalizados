import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { TransferRequest } from '@/types/transfers';
import type {
  GeneratedDocument,
  QuestionnaireResponse,
  TransferPatientData,
} from '@/types/transferDocuments';
import { getHospitalConfigById } from '@/constants/hospitalConfigs';

export interface TransferDocumentPackageCacheEntry {
  signature: string;
  documents: GeneratedDocument[];
  patientData: TransferPatientData;
}

export interface TransferDocumentPackageSuccess {
  kind: 'success' | 'cached';
  documents: GeneratedDocument[];
  patientData: TransferPatientData;
  signature: string;
}

export interface TransferDocumentPackageEmpty {
  kind: 'empty';
}

export interface TransferDocumentPackageError {
  kind: 'error';
  error: unknown;
}

export type TransferDocumentPackageResult =
  | TransferDocumentPackageSuccess
  | TransferDocumentPackageEmpty
  | TransferDocumentPackageError;

export const buildTransferPatientData = (
  record: DailyRecord | null,
  transfer: TransferRequest
): TransferPatientData => {
  const currentPatient = record?.beds[transfer.bedId];
  const snapshotBirthDate =
    'birthDate' in transfer.patientSnapshot
      ? (transfer.patientSnapshot.birthDate as string)
      : undefined;
  const birthDate = snapshotBirthDate || currentPatient?.birthDate || '';

  return {
    patientName: transfer.patientSnapshot.name,
    rut: transfer.patientSnapshot.rut || '',
    birthDate,
    age: transfer.patientSnapshot.age,
    diagnosis: transfer.patientSnapshot.diagnosis,
    admissionDate: transfer.patientSnapshot.admissionDate,
    bedName: transfer.bedId.replace('BED_', ''),
    bedType: 'Básica',
    isUPC: false,
    originHospital: 'Hospital Hanga Roa',
  };
};

export const buildTransferDocumentSignature = (
  transfer: TransferRequest,
  hospitalId: string,
  responses: QuestionnaireResponse,
  patientData: TransferPatientData
): string =>
  JSON.stringify({
    hospitalId,
    patientSnapshot: transfer.patientSnapshot,
    bedId: transfer.bedId,
    destinationHospital: transfer.destinationHospital,
    requiredSpecialty: transfer.requiredSpecialty,
    requiredBedType: transfer.requiredBedType,
    observations: transfer.observations,
    customFields: transfer.customFields,
    questionnaireResponses: responses,
    patientData,
  });

interface PrepareTransferDocumentPackageParams {
  cache: Map<string, TransferDocumentPackageCacheEntry>;
  record: DailyRecord | null;
  transfer: TransferRequest;
  hospitalId: string;
  responses: QuestionnaireResponse;
  updateTransfer: (id: string, data: Partial<TransferRequest>) => Promise<void>;
  persistResponses?: boolean;
}

export const prepareTransferDocumentPackage = async ({
  cache,
  record,
  transfer,
  hospitalId,
  responses,
  updateTransfer,
  persistResponses = false,
}: PrepareTransferDocumentPackageParams): Promise<TransferDocumentPackageResult> => {
  const hospital = getHospitalConfigById(hospitalId);
  if (!hospital) {
    return { kind: 'empty' };
  }

  const patientData = buildTransferPatientData(record, transfer);
  const signature = buildTransferDocumentSignature(transfer, hospitalId, responses, patientData);
  const cachedPackage = cache.get(transfer.id);

  if (cachedPackage && cachedPackage.signature === signature) {
    return {
      kind: 'cached',
      documents: cachedPackage.documents,
      patientData: cachedPackage.patientData,
      signature,
    };
  }

  try {
    if (persistResponses) {
      await updateTransfer(transfer.id, {
        questionnaireResponses: responses,
      });
    }

    const { generateTransferDocuments } =
      await import('@/services/transfers/documentGeneratorService');
    const documents = await generateTransferDocuments(patientData, responses, hospital);

    if (documents.length === 0) {
      return { kind: 'empty' };
    }

    cache.set(transfer.id, {
      signature,
      documents,
      patientData,
    });

    return {
      kind: 'success',
      documents,
      patientData,
      signature,
    };
  } catch (error) {
    return {
      kind: 'error',
      error,
    };
  }
};
