import { DailyRecord } from '@/types';
import type { CensusWorkbookSheetDescriptor } from '@/services/exporters/censusMasterWorkbook';
import {
  getDevelopmentSendDisabledMessage,
  resolveCensusEmailRuntimePolicy,
} from '@/services/integrations/censusEmailRuntimePolicy';
import { sendCensusEmailRequest } from '@/services/integrations/censusEmailNetworkClient';
import { buildCensusEmailRequestBody } from '@/services/integrations/censusEmailRequestPayload';
import { saveCensusEmailExportPassword } from '@/services/integrations/censusEmailAudit';
import { resolveCensusEmailRecipients } from '@/services/integrations/censusEmailRecipients';
import { assertCensusEmailSendingAllowed } from '@/services/integrations/censusEmailSendPolicy';

interface TriggerEmailParams {
  date: string;
  records: DailyRecord[];
  recipients?: string[];
  nursesSignature?: string;
  body?: string;
  shareLink?: string;
  userEmail?: string | null;
  userRole?: string | null;
  sheetDescriptors?: CensusWorkbookSheetDescriptor[];
}

interface EmailResponse {
  success: boolean;
  message: string;
  gmailId: string;
  censusDate?: string;
  exportPassword?: string;
}

const { endpoint: ENDPOINT, allowDevelopmentEmailSend } = resolveCensusEmailRuntimePolicy({
  isDevelopment: import.meta.env.DEV,
  allowDevEmailSendRaw: import.meta.env.VITE_ALLOW_DEV_EMAIL_SEND,
  endpointRaw: import.meta.env.VITE_CENSUS_EMAIL_ENDPOINT,
});

export const triggerCensusEmail = async (params: TriggerEmailParams): Promise<EmailResponse> => {
  const {
    date,
    records,
    recipients,
    nursesSignature,
    body,
    shareLink,
    userEmail,
    userRole,
    sheetDescriptors,
  } = params;

  assertCensusEmailSendingAllowed({
    isDevelopment: import.meta.env.DEV,
    allowDevelopmentEmailSend,
    date,
    recipients,
    recordCount: records.length,
    disabledMessage: getDevelopmentSendDisabledMessage(),
    endpoint: ENDPOINT,
  });

  const finalRecipients = resolveCensusEmailRecipients(recipients);

  const response = await sendCensusEmailRequest({
    endpoint: ENDPOINT,
    userEmail,
    userRole,
    body: buildCensusEmailRequestBody({
      date,
      records,
      recipients: finalRecipients,
      nursesSignature,
      body,
      shareLink,
      sheetDescriptors,
    }),
  });

  const result: EmailResponse = await response.json();

  if (result.exportPassword && result.censusDate) {
    await saveCensusEmailExportPassword(
      result.censusDate,
      result.exportPassword,
      userEmail || undefined
    );
  }

  return result;
};
