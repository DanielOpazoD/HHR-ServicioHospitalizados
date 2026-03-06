import type { ApplicationIssue, ApplicationOutcome } from '@/application/shared/applicationOutcome';

export interface BackupExportOutcomePresentation {
  channel: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
}

const resolveIssueMessage = (issues: ApplicationIssue[], fallback: string) =>
  issues[0]?.message || fallback;

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
  if (outcome.status === 'success') {
    return {
      channel: 'success',
      title: options.successTitle,
      message: options.successMessage,
    };
  }

  if (outcome.status === 'partial' || outcome.status === 'degraded') {
    return {
      channel: 'warning',
      title: options.partialTitle,
      message: outcome.issues.map(issue => issue.message).join('\n'),
    };
  }

  return {
    channel: 'error',
    title: options.failedTitle,
    message: resolveIssueMessage(outcome.issues, options.fallbackErrorMessage),
  };
};
