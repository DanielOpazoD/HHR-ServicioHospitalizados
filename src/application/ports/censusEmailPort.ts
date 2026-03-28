import { triggerCensusEmail } from '@/services/integrations/censusEmailService';
import type { CensusExportRecord } from '@/services/contracts/censusExportServiceContracts';
import type { CensusWorkbookSheetDescriptor } from '@/services/exporters/censusMasterWorkbook';
import {
  createApplicationFailed,
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/application/shared/applicationOutcome';

export interface CensusEmailSendPayload {
  date: string;
  records: CensusExportRecord[];
  recipients?: string[];
  nursesSignature?: string;
  body?: string;
  userEmail?: string | null;
  userRole?: string | null;
  sheetDescriptors?: CensusWorkbookSheetDescriptor[];
}

export interface CensusEmailDeliveryPort {
  sendEmail: (payload: CensusEmailSendPayload) => Promise<void>;
  uploadBackup: (blob: Blob, date: string) => Promise<void>;
  sendEmailWithResult: (payload: CensusEmailSendPayload) => Promise<ApplicationOutcome<void>>;
  uploadBackupWithResult: (blob: Blob, date: string) => Promise<ApplicationOutcome<void>>;
}

const toCensusEmailFailure = (fallbackMessage: string, message?: string | null) =>
  createApplicationFailed(undefined, [
    {
      kind: 'unknown',
      message: message || fallbackMessage,
      userSafeMessage: message || fallbackMessage,
    },
  ]);

export const defaultCensusEmailDeliveryPort: CensusEmailDeliveryPort = {
  sendEmail: async payload => {
    const result = await defaultCensusEmailDeliveryPort.sendEmailWithResult(payload);
    if (result.status !== 'success') {
      throw new Error(result.issues[0]?.message || 'No se pudo enviar el correo de censo.');
    }
  },
  uploadBackup: async (blob, date) => {
    const result = await defaultCensusEmailDeliveryPort.uploadBackupWithResult(blob, date);
    if (result.status !== 'success') {
      throw new Error(result.issues[0]?.message || 'No se pudo respaldar el censo.');
    }
  },
  sendEmailWithResult: async payload => {
    const result = await triggerCensusEmail(payload);
    if (!result.success) {
      return toCensusEmailFailure('No se pudo enviar el correo de censo.', result.message);
    }
    return createApplicationSuccess(undefined);
  },
  uploadBackupWithResult: async (blob, date) => {
    try {
      const { uploadCensus } = await import('@/services/backup/censusStorageService');
      await uploadCensus(blob, date);
      return createApplicationSuccess(undefined);
    } catch (error) {
      return createApplicationFailed(undefined, [
        {
          kind: 'unknown',
          message: error instanceof Error ? error.message : 'No se pudo respaldar el censo.',
          userSafeMessage:
            error instanceof Error ? error.message : 'No se pudo respaldar el censo.',
        },
      ]);
    }
  },
};
