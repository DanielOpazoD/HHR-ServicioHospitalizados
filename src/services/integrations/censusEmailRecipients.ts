import { CENSUS_DEFAULT_RECIPIENTS } from '@/constants/email';

export const resolveCensusEmailRecipients = (recipients?: string[]): string[] => {
  const finalRecipients =
    recipients && recipients.length > 0 ? recipients : CENSUS_DEFAULT_RECIPIENTS;

  if (finalRecipients.length === 0) {
    throw new Error(
      'No se especificaron destinatarios para el correo. Configure los destinatarios antes de enviar.'
    );
  }

  return finalRecipients;
};
