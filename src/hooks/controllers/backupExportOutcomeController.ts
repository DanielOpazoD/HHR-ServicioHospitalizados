import {
  isApplicationOutcomeNonFailure,
  isApplicationOutcomeSuccess,
  type ApplicationOutcome,
} from '@/shared/contracts/applicationOutcomeTypes';
import {
  joinApplicationIssueMessages,
  resolvePrimaryApplicationIssueMessage,
} from '@/shared/contracts/applicationOutcomeMessage';
import type { OperationalNotice } from '@/shared/feedback/operationalNoticePolicy';

export interface BackupExportOutcomePresentation {
  channel: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
  state?: OperationalNotice['state'];
  actionRequired?: boolean;
}

export const presentBackupExportOutcome = <T>(
  outcome: ApplicationOutcome<T>,
  options: {
    successTitle: string;
    successMessage?: string;
    partialTitle: string;
    failedTitle: string;
    fallbackErrorMessage: string;
  }
): BackupExportOutcomePresentation => {
  if (isApplicationOutcomeSuccess(outcome)) {
    return {
      channel: 'success',
      title: options.successTitle,
      message: options.successMessage,
      state: 'ok',
      actionRequired: false,
    };
  }

  if (isApplicationOutcomeNonFailure(outcome)) {
    return {
      channel: 'warning',
      title: options.partialTitle,
      message: joinApplicationIssueMessages(outcome.issues),
      state: outcome.status === 'partial' ? 'pending' : 'degraded',
      actionRequired: false,
    };
  }

  return {
    channel: 'error',
    title: options.failedTitle,
    message: resolvePrimaryApplicationIssueMessage(outcome.issues, options.fallbackErrorMessage),
    state: 'blocked',
    actionRequired: true,
  };
};
