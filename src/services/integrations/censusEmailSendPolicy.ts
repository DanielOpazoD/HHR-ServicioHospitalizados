import { CENSUS_DEFAULT_RECIPIENTS } from '@/constants/email';

export const assertCensusEmailSendingAllowed = ({
  isDevelopment,
  allowDevelopmentEmailSend,
  date,
  recipients,
  recordCount,
  disabledMessage,
  endpoint,
}: {
  isDevelopment: boolean;
  allowDevelopmentEmailSend: boolean;
  date: string;
  recipients?: string[];
  recordCount: number;
  disabledMessage: string;
  endpoint: string;
}): void => {
  if (isDevelopment && !allowDevelopmentEmailSend) {
    console.warn('[CensusEmail] Modo desarrollo con envío deshabilitado por defecto.');
    console.warn('[CensusEmail] Datos que se enviarían:', {
      date,
      recipientCount: recipients?.length || CENSUS_DEFAULT_RECIPIENTS.length,
      recordCount,
    });

    throw new Error(disabledMessage);
  }

  if (isDevelopment && allowDevelopmentEmailSend) {
    console.warn(`[CensusEmail] Modo desarrollo habilitado. Endpoint: ${endpoint}`);
  }
};
