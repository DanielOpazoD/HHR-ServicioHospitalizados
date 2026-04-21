import { useCallback, useState } from 'react';
import { CENSUS_DEFAULT_RECIPIENTS } from '@/constants/email';
import {
  CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST,
  type GlobalEmailRecipientList,
} from '@/services/email/emailRecipientListService';
import type { CensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import {
  applyRecipientSyncRuntimeMetadata,
  type RecipientRuntimeMetadata,
  type RecipientRuntimeState,
  resolveRecipientRuntimeMetadata,
  resolveRecipientSelectionRuntimeState,
  resolveRecipientSyncState,
} from '@/hooks/controllers/censusEmailRecipientRuntimeController';
import {
  buildCreateRecipientListMutationSpec,
  buildDeleteRecipientListMutationSpec,
  buildRenameRecipientListMutationSpec,
  type RecipientRuntimeMutationSpec,
} from '@/hooks/controllers/censusEmailRecipientMutationActionController';
import { executeRecipientRuntimeMutationSpec } from '@/hooks/controllers/censusEmailRecipientMutationRunner';
import { useCensusEmailRecipientBootstrapEffect } from '@/hooks/useCensusEmailRecipientBootstrapEffect';
import { useCensusEmailRecipientDeferredSyncEffect } from '@/hooks/useCensusEmailRecipientDeferredSyncEffect';
import { useCensusEmailRecipientPersistenceEffect } from '@/hooks/useCensusEmailRecipientPersistenceEffect';

interface UseCensusEmailRecipientListsParams {
  canManageGlobalRecipientLists: boolean;
  browserRuntime: CensusEmailBrowserRuntime;
  enabled: boolean;
  user: { uid?: string; email?: string | null } | null;
}

interface UseCensusEmailRecipientListsReturn {
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
  enabled,
  user,
}: UseCensusEmailRecipientListsParams): UseCensusEmailRecipientListsReturn => {
  const [recipients, setRecipientsState] = useState<string[]>(CENSUS_DEFAULT_RECIPIENTS);
  const [recipientLists, setRecipientLists] = useState<GlobalEmailRecipientList[]>([]);
  const [recipientsSource, setRecipientsSource] = useState<'firebase' | 'local' | 'default'>(
    'default'
  );
  const [isRecipientsSyncing, setIsRecipientsSyncing] = useState(false);
  const [recipientsSyncError, setRecipientsSyncError] = useState<string | null>(null);
  const [runtimeMetadata, setRuntimeMetadata] = useState<RecipientRuntimeMetadata>({
    recipientsReady: false,
    activeRecipientListId: CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id,
    lastRemoteRecipients: null,
  });

  const setActiveRecipientListId = useCallback((listId: string) => {
    setRuntimeMetadata(current => ({
      ...current,
      activeRecipientListId: listId,
    }));
  }, []);

  const setRecipients = useCallback((nextRecipients: string[]) => {
    setRecipientsState(nextRecipients);
  }, []);

  const applyRecipientRuntimeState = useCallback((nextState: RecipientRuntimeState) => {
    setRecipientLists(nextState.recipientLists);
    setRecipientsState(nextState.recipients);
    setRecipientsSource(nextState.recipientsSource);
    setRecipientsSyncError(nextState.recipientsSyncError);
    setRuntimeMetadata(resolveRecipientRuntimeMetadata(nextState));
  }, []);

  const applyRecipientSyncState = useCallback(
    (nextState: ReturnType<typeof resolveRecipientSyncState>) => {
      if (nextState.recipientsSource) {
        setRecipientsSource(nextState.recipientsSource);
      }
      setRecipientsSyncError(nextState.recipientsSyncError);
      setRuntimeMetadata(current => applyRecipientSyncRuntimeMetadata(current, nextState));
    },
    []
  );

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
    [applyRecipientRuntimeState]
  );

  useCensusEmailRecipientBootstrapEffect({
    canManageGlobalRecipientLists,
    browserRuntime,
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

  const createRecipientList = useCallback(
    async (name: string) => {
      await runRecipientRuntimeMutation(
        buildCreateRecipientListMutationSpec({
          canManageGlobalRecipientLists,
          name,
          recipients,
          recipientLists,
          actor: user,
        })
      );
    },
    [canManageGlobalRecipientLists, runRecipientRuntimeMutation, recipientLists, recipients, user]
  );

  const renameActiveRecipientList = useCallback(
    async (name: string) => {
      await runRecipientRuntimeMutation(
        buildRenameRecipientListMutationSpec({
          canManageGlobalRecipientLists,
          activeRecipientListId: runtimeMetadata.activeRecipientListId,
          name,
          recipients,
          recipientLists,
          actor: user,
        })
      );
    },
    [
      canManageGlobalRecipientLists,
      runRecipientRuntimeMutation,
      recipientLists,
      recipients,
      runtimeMetadata.activeRecipientListId,
      user,
    ]
  );

  const deleteRecipientList = useCallback(
    async (listId: string) => {
      await runRecipientRuntimeMutation(
        buildDeleteRecipientListMutationSpec({
          canManageGlobalRecipientLists,
          recipientLists,
          listId,
        })
      );
    },
    [canManageGlobalRecipientLists, runRecipientRuntimeMutation, recipientLists]
  );

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
