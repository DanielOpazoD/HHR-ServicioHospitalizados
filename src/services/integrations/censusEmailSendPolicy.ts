import { CENSUS_DEFAULT_RECIPIENTS } from '@/constants/email';
import { censusEmailSendPolicyLogger } from '@/services/integrations/integrationLoggers';

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
    censusEmailSendPolicyLogger.warn('Development mode email sending disabled by default');
    censusEmailSendPolicyLogger.warn('Development mode email payload preview', {
      date,
      recipientCount: recipients?.length || CENSUS_DEFAULT_RECIPIENTS.length,
      recordCount,
    });

    throw new Error(disabledMessage);
  }

  if (isDevelopment && allowDevelopmentEmailSend) {
    censusEmailSendPolicyLogger.warn(
      `Development mode email sending enabled. Endpoint: ${endpoint}`
    );
  }
};
