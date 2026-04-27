import { useCallback } from 'react';
import type { GlobalEmailRecipientList } from '@/services/email/emailRecipientListService';
import type { CensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import { resolveRecipientSelectionRuntimeState } from '@/hooks/controllers/censusEmailRecipientRuntimeController';
import type { RecipientRuntimeMutationSpec } from '@/hooks/controllers/censusEmailRecipientMutationActionController';
import { executeRecipientRuntimeMutationSpec } from '@/hooks/controllers/censusEmailRecipientMutationRunner';
import { useCensusEmailRecipientBootstrapEffect } from '@/hooks/useCensusEmailRecipientBootstrapEffect';
import { useCensusEmailRecipientDeferredSyncEffect } from '@/hooks/useCensusEmailRecipientDeferredSyncEffect';
import { useCensusEmailRecipientMutationActions } from '@/hooks/useCensusEmailRecipientMutationActions';
import { useCensusEmailRecipientPersistenceEffect } from '@/hooks/useCensusEmailRecipientPersistenceEffect';
import { useCensusEmailRecipientRuntimeState } from '@/hooks/useCensusEmailRecipientRuntimeState';

interface UseCensusEmailRecipientListsParams {
  canManageGlobalRecipientLists: boolean;
  browserRuntime: CensusEmailBrowserRuntime;
  bootstrapEnabled: boolean;
  enabled: boolean;
  user: { uid?: string; email?: string | null } | null;
}

export interface UseCensusEmailRecipientListsReturn {
  recipients: string[];
  setRecipients: (recipients: string[]) => void;
  recipientLists: GlobalEmailRecipientList[];
  activeRecipientListId: string;
  setActiveRecipientListId: (listId: string) => void;
  createRecipientList: (name: string) => Promise<void>;
  renameActiveRecipientList: (name: string) => Promise<void>;
  deleteRecipientList: (listId: string) => Promise<void>;
  recipientsSource: 'firebase' | 'local' | 'default';
  isRecipientsSyncing: boolean;
  recipientsSyncError: string | null;
}

export { resolveStoredRecipientSelection } from '@/hooks/controllers/censusEmailRecipientSelectionController';

export const useCensusEmailRecipientLists = ({
  canManageGlobalRecipientLists,
  browserRuntime,
  bootstrapEnabled,
  enabled,
  user,
}: UseCensusEmailRecipientListsParams): UseCensusEmailRecipientListsReturn => {
  const {
    recipients,
    setRecipients,
    recipientLists,
    recipientsSource,
    isRecipientsSyncing,
    setIsRecipientsSyncing,
    recipientsSyncError,
    setRecipientsSyncError,
    runtimeMetadata,
    setActiveRecipientListId,
    applyRecipientRuntimeState,
    applyRecipientSyncState,
  } = useCensusEmailRecipientRuntimeState();

  const selectActiveRecipientList = useCallback(
    (listId: string) => {
      const nextState = resolveRecipientSelectionRuntimeState({
        canManageGlobalRecipientLists,
        recipientLists,
        listId,
      });
      if (!nextState.shouldApplyActiveList) {
        setActiveRecipientListId(nextState.activeRecipientListId);
        return;
      }

      applyRecipientRuntimeState(nextState.runtimeState);
    },
    [
      applyRecipientRuntimeState,
      canManageGlobalRecipientLists,
      recipientLists,
      setActiveRecipientListId,
    ]
  );

  const runRecipientRuntimeMutation = useCallback(
    async <T>(spec: RecipientRuntimeMutationSpec<T>) => {
      await executeRecipientRuntimeMutationSpec(spec, {
        applyRuntimeState: applyRecipientRuntimeState,
        resolveRuntimeState: spec.resolveRuntimeState,
        setRecipientsSyncing: setIsRecipientsSyncing,
        setRecipientsSyncError,
      });
    },
    [applyRecipientRuntimeState, setIsRecipientsSyncing, setRecipientsSyncError]
  );

  useCensusEmailRecipientBootstrapEffect({
    canManageGlobalRecipientLists,
    browserRuntime,
    bootstrapEnabled,
    enabled,
    user,
    applyRecipientRuntimeState,
  });

  useCensusEmailRecipientPersistenceEffect({
    activeRecipientListId: runtimeMetadata.activeRecipientListId,
    recipientsReady: runtimeMetadata.recipientsReady,
    recipients,
  });

  useCensusEmailRecipientDeferredSyncEffect({
    enabled,
    canManageGlobalRecipientLists,
    recipientsReady: runtimeMetadata.recipientsReady,
    recipients,
    lastRemoteRecipients: runtimeMetadata.lastRemoteRecipients,
    recipientLists,
    activeRecipientListId: runtimeMetadata.activeRecipientListId,
    user,
    onSyncStart: () => {
      setIsRecipientsSyncing(true);
      setRecipientsSyncError(null);
    },
    onSyncState: applyRecipientSyncState,
    onSyncComplete: () => {
      setIsRecipientsSyncing(false);
    },
  });

  const { createRecipientList, renameActiveRecipientList, deleteRecipientList } =
    useCensusEmailRecipientMutationActions({
      canManageGlobalRecipientLists,
      recipients,
      recipientLists,
      activeRecipientListId: runtimeMetadata.activeRecipientListId,
      user,
      runRecipientRuntimeMutation,
    });

  return {
    recipients,
    setRecipients,
    recipientLists,
    activeRecipientListId: runtimeMetadata.activeRecipientListId,
    setActiveRecipientListId: selectActiveRecipientList,
    createRecipientList,
    renameActiveRecipientList,
    deleteRecipientList,
    recipientsSource,
    isRecipientsSyncing,
    recipientsSyncError,
  };
};
