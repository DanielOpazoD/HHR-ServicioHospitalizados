import type { CensusRecipientSelectionSource } from '@/hooks/controllers/censusEmailRecipientSelectionController';
import { resolveApplicationOutcomeMessage } from '@/shared/contracts/applicationOutcomeMessage';

interface ApplicationOutcomeLike<TData = unknown> {
  status: string;
  data?: TData;
  issues?: Array<{ message?: string; userSafeMessage?: string }>;
  userSafeMessage?: string;
}

export const resolveBootstrapRecipientFallbackMessage = (result: ApplicationOutcomeLike): string =>
  resolveApplicationOutcomeMessage(
    result,
    'No se pudo cargar la lista global en Firebase. Se usara la copia local.'
  );

export const resolveRecipientSyncState = (
  result: ApplicationOutcomeLike<{ skipped?: boolean }>,
  recipients: string[]
): {
  recipientsSource: CensusRecipientSelectionSource | null;
  recipientsSyncError: string | null;
  lastRemoteRecipients: string[] | null;
} => {
  if (result.status === 'success') {
    if (result.data?.skipped) {
      return {
        recipientsSource: null,
        recipientsSyncError: null,
        lastRemoteRecipients: null,
      };
    }

    return {
      recipientsSource: 'firebase',
      recipientsSyncError: null,
      lastRemoteRecipients: recipients,
    };
  }

  return {
    recipientsSource: null,
    recipientsSyncError: resolveApplicationOutcomeMessage(
      result,
      'No se pudo sincronizar la lista global en Firebase. Se mantiene la copia local.'
    ),
    lastRemoteRecipients: null,
  };
};

export const resolveRecipientMutationFailureMessage = (
  result: ApplicationOutcomeLike,
  fallbackMessage: string
): string => resolveApplicationOutcomeMessage(result, fallbackMessage);
