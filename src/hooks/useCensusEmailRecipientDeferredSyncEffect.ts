import { useEffect } from 'react';
import { scheduleDeferredRecipientSync } from '@/hooks/controllers/censusEmailRecipientDeferredSyncController';
import type { GlobalEmailRecipientList } from '@/services/email/emailRecipientListService';
import { resolveRecipientSyncState } from '@/hooks/controllers/censusEmailRecipientRuntimeController';
import { resolveDeferredRecipientSyncInput } from '@/hooks/controllers/censusEmailRecipientSyncController';
import { withRecipientListUseCases } from '@/hooks/controllers/censusEmailRecipientUseCaseLoader';

interface UseCensusEmailRecipientDeferredSyncEffectParams {
  enabled: boolean;
  canManageGlobalRecipientLists: boolean;
  recipientsReady: boolean;
  recipients: string[];
  lastRemoteRecipients: string[] | null;
  recipientLists: GlobalEmailRecipientList[];
  activeRecipientListId: string;
  user: { uid?: string; email?: string | null } | null;
  onSyncStart: () => void;
  onSyncState: (nextState: ReturnType<typeof resolveRecipientSyncState>) => void;
  onSyncComplete: () => void;
}

export const useCensusEmailRecipientDeferredSyncEffect = ({
  enabled,
  canManageGlobalRecipientLists,
  recipientsReady,
  recipients,
  lastRemoteRecipients,
  recipientLists,
  activeRecipientListId,
  user,
  onSyncStart,
  onSyncState,
  onSyncComplete,
}: UseCensusEmailRecipientDeferredSyncEffectParams): void => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const syncInput = resolveDeferredRecipientSyncInput({
      canManageGlobalRecipientLists,
      recipientsReady,
      recipients,
      lastRemoteRecipients,
      recipientLists,
      activeRecipientListId,
      actor: user,
    });
    if (!syncInput) {
      return;
    }

    return scheduleDeferredRecipientSync({
      syncInput,
      recipients,
      executeSync: input =>
        withRecipientListUseCases(({ executeSyncCensusRecipientList }) =>
          executeSyncCensusRecipientList(input)
        ),
      onSyncStart,
      onSyncState,
      onSyncComplete,
    });
  }, [
    activeRecipientListId,
    canManageGlobalRecipientLists,
    enabled,
    lastRemoteRecipients,
    onSyncComplete,
    onSyncStart,
    onSyncState,
    recipientLists,
    recipients,
    recipientsReady,
    user,
  ]);
};
