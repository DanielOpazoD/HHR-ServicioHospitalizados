import { getHospitalConfigByDestinationName } from '@/constants/hospitalConfigs';
import type { TransferRequest } from '@/types/transfers';
import type { TransferDocumentPackageResult } from './transferDocumentPackageController';

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

export const withSelectedTransfer = async (
  selectedTransfer: TransferRequest | null,
  run: (transfer: TransferRequest) => Promise<void>
): Promise<void> => {
  if (!selectedTransfer) {
    return;
  }

  await run(selectedTransfer);
};
