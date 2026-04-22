import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';
import { resolveApplicationOutcomeMessage } from '@/shared/contracts/applicationOutcomeMessage';

export interface HandoffManagementOutcomeNotice {
  message: string;
  title: string;
}

export const presentHandoffManagementFailure = <T>(
  outcome: ApplicationOutcome<T>,
  options: {
    fallbackMessage: string;
    fallbackTitle: string;
    reasonTitles?: Partial<Record<string, string>>;
  }
): HandoffManagementOutcomeNotice => ({
  message: resolveApplicationOutcomeMessage(outcome, options.fallbackMessage),
  title: (outcome.reason && options.reasonTitles?.[outcome.reason]) || options.fallbackTitle,
});
