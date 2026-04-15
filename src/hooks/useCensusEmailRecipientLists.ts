import { useCallback, useEffect, useRef, useState } from 'react';
import { CENSUS_DEFAULT_RECIPIENTS } from '@/constants/email';
import { saveAppSetting } from '@/services/settingsService';
import {
  areGlobalEmailRecipientsEqual,
  CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST,
  type GlobalEmailRecipientList,
} from '@/services/email/emailRecipientListService';
import type { CensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import { resolveStoredRecipientSelection } from '@/hooks/controllers/censusEmailRecipientSelectionController';
import {
  resolveRecipientMutationFailureMessage,
  resolveRecipientSyncState,
} from '@/hooks/controllers/censusEmailRecipientRuntimeController';
import {
  resolveRecipientListsAfterCreate,
  resolveRecipientListForSelection,
  resolveRecipientListsAfterRename,
  resolveRecipientSelectionAfterDelete,
} from '@/hooks/controllers/censusEmailRecipientMutationController';
import { resolveDeferredRecipientSyncInput } from '@/hooks/controllers/censusEmailRecipientSyncController';

const RECIPIENT_LIST_KEY = 'censusEmailActiveRecipientListId';
const RECIPIENTS_STORAGE_KEY = 'censusEmailRecipients';
let censusRecipientListUseCasesPromise: Promise<
  typeof import('@/application/census-email/censusRecipientListUseCases')
> | null = null;

const loadCensusRecipientListUseCases = async () => {
  censusRecipientListUseCasesPromise ??=
    import('@/application/census-email/censusRecipientListUseCases');
  return censusRecipientListUseCasesPromise;
};

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

  const applyRecipientRuntimeState = useCallback(
    (nextState: {
      recipientLists: GlobalEmailRecipientList[];
      activeRecipientListId: string;
      recipients: string[];
      recipientsSource: 'firebase' | 'local' | 'default';
      recipientsSyncError: string | null;
      lastRemoteRecipients: string[] | null;
    }) => {
      setRecipientLists(nextState.recipientLists);
      activeRecipientListIdRef.current = nextState.activeRecipientListId;
      setActiveRecipientListIdState(nextState.activeRecipientListId);
      setRecipientsState(nextState.recipients);
      setRecipientsSource(nextState.recipientsSource);
      setRecipientsSyncError(nextState.recipientsSyncError);
      lastRemoteRecipientsRef.current = nextState.lastRemoteRecipients;
      recipientsReadyRef.current = true;
    },
    []
  );

  const applyActiveRecipientList = useCallback(
    (list: GlobalEmailRecipientList) => {
      setActiveRecipientListId(list.id);
      lastRemoteRecipientsRef.current = list.recipients;
      recipientsReadyRef.current = true;
      setRecipientsSource('firebase');
      setRecipientsSyncError(null);
      setRecipientsState(currentRecipients =>
        areGlobalEmailRecipientsEqual(currentRecipients, list.recipients)
          ? currentRecipients
          : list.recipients
      );
      void saveAppSetting(RECIPIENTS_STORAGE_KEY, list.recipients);
    },
    [setActiveRecipientListId]
  );

  const selectActiveRecipientList = useCallback(
    (listId: string) => {
      const activeList = resolveRecipientListForSelection(recipientLists, listId);
      if (!activeList || !canManageGlobalRecipientLists) {
        setActiveRecipientListId(listId);
        return;
      }

      applyActiveRecipientList(activeList);
    },
    [
      applyActiveRecipientList,
      canManageGlobalRecipientLists,
      recipientLists,
      setActiveRecipientListId,
    ]
  );

  const runRecipientListMutation = useCallback(
    async <T>(
      execute: () => Promise<{
        status: string;
        data?: T;
        issues?: Array<{ message?: string; userSafeMessage?: string }>;
        userSafeMessage?: string;
      }>,
      {
        onSuccess,
        fallbackMessage,
      }: {
        onSuccess: (data: NonNullable<T>) => void;
        fallbackMessage: string;
      }
    ) => {
      setIsRecipientsSyncing(true);
      setRecipientsSyncError(null);
      try {
        const result = await execute();
        if (result.status === 'success' && result.data != null) {
          onSuccess(result.data as NonNullable<T>);
          return;
        }

        setRecipientsSyncError(resolveRecipientMutationFailureMessage(result, fallbackMessage));
      } finally {
        setIsRecipientsSyncing(false);
      }
    },
    []
  );

  useEffect(() => {
    let isActive = true;

    const loadRecipients = async () => {
      const { executeLoadCensusRecipientRuntimeState } = await loadCensusRecipientListUseCases();
      const runtimeResult = await executeLoadCensusRecipientRuntimeState({
        canManageGlobalRecipientLists,
        browserRuntime,
        enabled,
        activeListStorageKey: RECIPIENT_LIST_KEY,
        recipientsStorageKey: RECIPIENTS_STORAGE_KEY,
        user,
      });

      if (!isActive) {
        return;
      }

      if (runtimeResult.status === 'success' && runtimeResult.data) {
        applyRecipientRuntimeState(runtimeResult.data);
      }
    };

    void loadRecipients();

    return () => {
      isActive = false;
    };
  }, [
    applyActiveRecipientList,
    browserRuntime,
    canManageGlobalRecipientLists,
    enabled,
    applyRecipientRuntimeState,
    user,
  ]);

  useEffect(() => {
    if (!recipientsReadyRef.current) {
      return;
    }

    void saveAppSetting(RECIPIENTS_STORAGE_KEY, recipients);
  }, [recipients]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      const syncInput = resolveDeferredRecipientSyncInput({
        canManageGlobalRecipientLists,
        recipientsReady: recipientsReadyRef.current,
        recipients,
        lastRemoteRecipients: lastRemoteRecipientsRef.current,
        recipientLists,
        activeRecipientListId: activeRecipientListIdRef.current,
        actor: user,
      });
      if (!syncInput) {
        return;
      }

      setIsRecipientsSyncing(true);
      setRecipientsSyncError(null);

      void loadCensusRecipientListUseCases()
        .then(({ executeSyncCensusRecipientList }) => executeSyncCensusRecipientList(syncInput))
        .then(result => {
          if (cancelled) {
            return;
          }
          const nextState = resolveRecipientSyncState(result, recipients);
          if (nextState.recipientsSource) {
            setRecipientsSource(nextState.recipientsSource);
          }
          if (nextState.lastRemoteRecipients) {
            lastRemoteRecipientsRef.current = nextState.lastRemoteRecipients;
          }
          setRecipientsSyncError(nextState.recipientsSyncError);
        })
        .finally(() => {
          if (!cancelled) {
            setIsRecipientsSyncing(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      setIsRecipientsSyncing(false);
    };
  }, [
    activeRecipientListId,
    canManageGlobalRecipientLists,
    enabled,
    recipientLists,
    recipients,
    user,
  ]);

  const createRecipientList = useCallback(
    async (name: string) => {
      await runRecipientListMutation(
        async () => {
          const { executeCreateCensusRecipientList } = await loadCensusRecipientListUseCases();
          return executeCreateCensusRecipientList({
            canManageGlobalRecipientLists,
            name,
            recipients,
            recipientLists,
            actor: user,
          });
        },
        {
          onSuccess: result => {
            const nextState = resolveRecipientListsAfterCreate(recipientLists, result);
            setRecipientLists(nextState.recipientLists);
            applyActiveRecipientList(nextState.activeRecipientList);
          },
          fallbackMessage: 'No se pudo crear la nueva lista global.',
        }
      );
    },
    [
      applyActiveRecipientList,
      canManageGlobalRecipientLists,
      recipientLists,
      recipients,
      runRecipientListMutation,
      user,
    ]
  );

  const renameActiveRecipientList = useCallback(
    async (name: string) => {
      await runRecipientListMutation(
        async () => {
          const { executeRenameCensusRecipientList } = await loadCensusRecipientListUseCases();
          return executeRenameCensusRecipientList({
            canManageGlobalRecipientLists,
            activeList: resolveRecipientListForSelection(recipientLists, activeRecipientListId),
            name,
            recipients,
            actor: user,
          });
        },
        {
          onSuccess: result => {
            setRecipientLists(previousLists =>
              resolveRecipientListsAfterRename(previousLists, result)
            );
          },
          fallbackMessage: 'No se pudo actualizar el nombre de la lista global.',
        }
      );
    },
    [
      activeRecipientListId,
      canManageGlobalRecipientLists,
      recipientLists,
      recipients,
      runRecipientListMutation,
      user,
    ]
  );

  const deleteRecipientList = useCallback(
    async (listId: string) => {
      await runRecipientListMutation(
        async () => {
          const { executeDeleteCensusRecipientList } = await loadCensusRecipientListUseCases();
          return executeDeleteCensusRecipientList({
            canManageGlobalRecipientLists,
            recipientLists,
            listId,
          });
        },
        {
          onSuccess: result => {
            const nextState = resolveRecipientSelectionAfterDelete({
              recipientLists,
              listId,
              fallbackList: result.fallbackList,
            });
            setRecipientLists(nextState.recipientLists);
            if (nextState.activeRecipientListId) {
              setActiveRecipientListId(nextState.activeRecipientListId);
            }
          },
          fallbackMessage: 'No se pudo eliminar la lista global seleccionada.',
        }
      );
    },
    [
      canManageGlobalRecipientLists,
      recipientLists,
      runRecipientListMutation,
      setActiveRecipientListId,
    ]
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
