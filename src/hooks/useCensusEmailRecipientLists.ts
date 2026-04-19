import { useCallback, useEffect, useRef, useState } from 'react';
import { CENSUS_DEFAULT_RECIPIENTS } from '@/constants/email';
import { saveAppSetting } from '@/services/settingsService';
import {
  CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST,
  type GlobalEmailRecipientList,
} from '@/services/email/emailRecipientListService';
import type { CensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import {
  type RecipientRuntimeState,
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

const RECIPIENT_LIST_KEY = 'censusEmailActiveRecipientListId';
const RECIPIENTS_STORAGE_KEY = 'censusEmailRecipients';

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
  const [activeRecipientListId, setActiveRecipientListIdState] = useState<string>(
    CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id
  );
  const [recipientsSource, setRecipientsSource] = useState<'firebase' | 'local' | 'default'>(
    'default'
  );
  const [isRecipientsSyncing, setIsRecipientsSyncing] = useState(false);
  const [recipientsSyncError, setRecipientsSyncError] = useState<string | null>(null);
  const recipientsReadyRef = useRef(false);
  const lastRemoteRecipientsRef = useRef<string[] | null>(null);
  const activeRecipientListIdRef = useRef<string>(CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id);

  const setActiveRecipientListId = useCallback((listId: string) => {
    activeRecipientListIdRef.current = listId;
    setActiveRecipientListIdState(listId);
    void saveAppSetting(RECIPIENT_LIST_KEY, listId);
  }, []);

  const setRecipients = useCallback((nextRecipients: string[]) => {
    setRecipientsState(nextRecipients);
  }, []);

  const applyRecipientRuntimeState = useCallback((nextState: RecipientRuntimeState) => {
    setRecipientLists(nextState.recipientLists);
    activeRecipientListIdRef.current = nextState.activeRecipientListId;
    setActiveRecipientListIdState(nextState.activeRecipientListId);
    setRecipientsState(nextState.recipients);
    setRecipientsSource(nextState.recipientsSource);
    setRecipientsSyncError(nextState.recipientsSyncError);
    lastRemoteRecipientsRef.current = nextState.lastRemoteRecipients;
    recipientsReadyRef.current = true;
  }, []);

  const applyRecipientRuntimeStateWithPersistence = useCallback(
    (nextState: RecipientRuntimeState) => {
      applyRecipientRuntimeState(nextState);
      void saveAppSetting(RECIPIENTS_STORAGE_KEY, nextState.recipients);
      void saveAppSetting(RECIPIENT_LIST_KEY, nextState.activeRecipientListId);
    },
    [applyRecipientRuntimeState]
  );

  const applyRecipientSyncState = useCallback(
    (nextState: ReturnType<typeof resolveRecipientSyncState>) => {
      if (nextState.recipientsSource) {
        setRecipientsSource(nextState.recipientsSource);
      }
      if (nextState.lastRemoteRecipients) {
        lastRemoteRecipientsRef.current = nextState.lastRemoteRecipients;
      }
      setRecipientsSyncError(nextState.recipientsSyncError);
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

      applyRecipientRuntimeStateWithPersistence(nextState.runtimeState);
    },
    [
      applyRecipientRuntimeStateWithPersistence,
      canManageGlobalRecipientLists,
      recipientLists,
      setActiveRecipientListId,
    ]
  );

  const executeRecipientRuntimeMutation = useCallback(
    async <T>(spec: RecipientRuntimeMutationSpec<T>) => {
      await executeRecipientRuntimeMutationSpec(spec, {
        applyRuntimeState: applyRecipientRuntimeStateWithPersistence,
        resolveRuntimeState: spec.resolveRuntimeState,
        setRecipientsSyncing: setIsRecipientsSyncing,
        setRecipientsSyncError,
      });
    },
    [applyRecipientRuntimeStateWithPersistence]
  );

  useCensusEmailRecipientBootstrapEffect({
    canManageGlobalRecipientLists,
    browserRuntime,
    enabled,
    user,
    applyRecipientRuntimeState,
  });

  useCensusEmailRecipientPersistenceEffect({
    recipientsReady: recipientsReadyRef.current,
    recipients,
  });

  useCensusEmailRecipientDeferredSyncEffect({
    enabled,
    canManageGlobalRecipientLists,
    recipientsReady: recipientsReadyRef.current,
    recipients,
    lastRemoteRecipients: lastRemoteRecipientsRef.current,
    recipientLists,
    activeRecipientListId: activeRecipientListIdRef.current,
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
      await executeRecipientRuntimeMutation(
        buildCreateRecipientListMutationSpec({
          canManageGlobalRecipientLists,
          name,
          recipients,
          recipientLists,
          actor: user,
        })
      );
    },
    [
      canManageGlobalRecipientLists,
      executeRecipientRuntimeMutation,
      recipientLists,
      recipients,
      user,
    ]
  );

  const renameActiveRecipientList = useCallback(
    async (name: string) => {
      await executeRecipientRuntimeMutation(
        buildRenameRecipientListMutationSpec({
          canManageGlobalRecipientLists,
          activeRecipientListId,
          name,
          recipients,
          recipientLists,
          actor: user,
        })
      );
    },
    [
      activeRecipientListId,
      canManageGlobalRecipientLists,
      executeRecipientRuntimeMutation,
      recipientLists,
      recipients,
      user,
    ]
  );

  const deleteRecipientList = useCallback(
    async (listId: string) => {
      await executeRecipientRuntimeMutation(
        buildDeleteRecipientListMutationSpec({
          canManageGlobalRecipientLists,
          recipientLists,
          listId,
        })
      );
    },
    [canManageGlobalRecipientLists, executeRecipientRuntimeMutation, recipientLists]
  );

  return {
    recipients,
    setRecipients,
    recipientLists,
    activeRecipientListId,
    setActiveRecipientListId: selectActiveRecipientList,
    createRecipientList,
    renameActiveRecipientList,
    deleteRecipientList,
    recipientsSource,
    isRecipientsSyncing,
    recipientsSyncError,
  };
};
