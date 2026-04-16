import { getHospitalConfigByDestinationName } from '@/constants/hospitalConfigs';
import type { TransferRequest } from '@/types/transfers';
import type {
  TransferDocumentPackageResult,
  TransferDocumentPackageSuccess,
} from './transferDocumentPackageController';
import type { QuestionnaireResponse } from '@/types/transferDocuments';

export const MISSING_TRANSFER_FORMS_MESSAGE =
  'Este hospital todavía no tiene formularios de traslado configurados.';

export const EMPTY_TRANSFER_DOCUMENT_PACKAGE_MESSAGE =
  'No fue posible preparar los documentos en este momento. Verifique las plantillas o intente nuevamente en unos segundos.';

export const TRANSFER_DOCUMENT_PACKAGE_ERROR_MESSAGE =
  'Error al generar documentos. Por favor intente nuevamente.';

export const resolveTransferDestinationHospitalId = (destinationHospital: string): string | null =>
  getHospitalConfigByDestinationName(destinationHospital)?.id ?? null;

export const resolveTransferDocumentPackageMessage = (
  result: TransferDocumentPackageResult
): string | null => {
  if (result.kind === 'empty') {
    return EMPTY_TRANSFER_DOCUMENT_PACKAGE_MESSAGE;
  }

  if (result.kind === 'error') {
    return TRANSFER_DOCUMENT_PACKAGE_ERROR_MESSAGE;
  }

  return null;
};

export type TransferDocumentWorkflowPlan =
  | {
      kind: 'blocked';
      message: string;
    }
  | {
      kind: 'open-questionnaire';
      hospitalId: string;
    }
  | {
      kind: 'open-package';
      hospitalId: string;
      responses: QuestionnaireResponse;
    }
  | {
      kind: 'noop';
    };

export const resolveTransferDocumentWorkflowPlan = ({
  transfer,
  mode,
}: {
  transfer: TransferRequest;
  mode: 'prepare' | 'view';
}): TransferDocumentWorkflowPlan => {
  const hospitalId = resolveTransferDestinationHospitalId(transfer.destinationHospital);
  if (!hospitalId) {
    return {
      kind: 'blocked',
      message: MISSING_TRANSFER_FORMS_MESSAGE,
    };
  }

  if (mode === 'view') {
    if (!transfer.questionnaireResponses) {
      return {
        kind: 'noop',
      };
    }

    return {
      kind: 'open-package',
      hospitalId,
      responses: transfer.questionnaireResponses,
    };
  }

  return {
    kind: 'open-questionnaire',
    hospitalId,
  };
};

export type TransferDocumentPackageApplyPlan =
  | {
      kind: 'message';
      message: string;
      shouldLogError: boolean;
    }
  | {
      kind: 'open-package';
      documents: TransferDocumentPackageSuccess['documents'];
      patientData: TransferDocumentPackageSuccess['patientData'];
    }
  | {
      kind: 'noop';
    };

export const resolveTransferDocumentPackageApplyPlan = (
  result: TransferDocumentPackageResult
): TransferDocumentPackageApplyPlan => {
  const message = resolveTransferDocumentPackageMessage(result);
  if (message) {
    return {
      kind: 'message',
      message,
      shouldLogError: result.kind === 'error',
    };
  }

  if (result.kind === 'success' || result.kind === 'cached') {
    return {
      kind: 'open-package',
      documents: result.documents,
      patientData: result.patientData,
    };
  }

  return {
    kind: 'noop',
  };
};

export const withSelectedTransfer = async (
  selectedTransfer: TransferRequest | null,
  run: (transfer: TransferRequest) => Promise<void>
): Promise<void> => {
  if (!selectedTransfer) {
    return;
  }

  await run(selectedTransfer);
};
