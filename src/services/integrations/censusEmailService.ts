import { DailyRecord } from '@/types';
import { CENSUS_DEFAULT_RECIPIENTS } from '@/constants/email';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getExportPasswordsPath } from '@/constants/firestorePaths';
import type { CensusWorkbookSheetDescriptor } from '@/services/exporters/censusMasterWorkbook';
import {
  getDevelopmentSendDisabledMessage,
  resolveCensusEmailRuntimePolicy,
} from '@/services/integrations/censusEmailRuntimePolicy';
import { sendCensusEmailRequest } from '@/services/integrations/censusEmailNetworkClient';

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

/**
 * Save export password to Firestore for audit purposes
 */
const saveExportPassword = async (
  date: string,
  password: string,
  createdBy?: string
): Promise<void> => {
  try {
    const db = getFirestore();
    const passwordsPath = getExportPasswordsPath();
    const docRef = doc(db, passwordsPath, date);

    await setDoc(
      docRef,
      {
        date,
        password,
        createdAt: new Date().toISOString(),
        createdBy,
        source: 'email',
      },
      { merge: true }
    );

    // console.debug(`[CensusEmail] Password saved to Firestore for ${date}`);
  } catch (error) {
    console.error('[CensusEmail] Failed to save password to Firestore:', error);
    // Don't throw - email was sent successfully, this is just for audit
  }
};

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

  // By default, avoid sending real emails from local dev to prevent accidental dispatches.
  // Teams can opt in explicitly using VITE_ALLOW_DEV_EMAIL_SEND=true.
  if (import.meta.env.DEV && !allowDevelopmentEmailSend) {
    console.warn('[CensusEmail] Modo desarrollo con envío deshabilitado por defecto.');
    console.warn('[CensusEmail] Datos que se enviarían:', {
      date,
      recipientCount: recipients?.length || CENSUS_DEFAULT_RECIPIENTS.length,
      recordCount: records.length,
    });

    throw new Error(getDevelopmentSendDisabledMessage());
  }

  if (import.meta.env.DEV && allowDevelopmentEmailSend) {
    console.warn(`[CensusEmail] Modo desarrollo habilitado. Endpoint: ${ENDPOINT}`);
  }

  // Validate recipients - must be provided explicitly since no hardcoded defaults
  const finalRecipients =
    recipients && recipients.length > 0 ? recipients : CENSUS_DEFAULT_RECIPIENTS;

  if (finalRecipients.length === 0) {
    throw new Error(
      'No se especificaron destinatarios para el correo. Configure los destinatarios antes de enviar.'
    );
  }

  const response = await sendCensusEmailRequest({
    endpoint: ENDPOINT,
    userEmail,
    userRole,
    body: JSON.stringify({
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

  // Save password to Firestore for audit purposes
  if (result.exportPassword && result.censusDate) {
    await saveExportPassword(result.censusDate, result.exportPassword, userEmail || undefined);
  }

  return result;
};
