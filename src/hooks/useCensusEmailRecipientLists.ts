import { useCallback, useEffect, useRef, useState } from 'react';
import { CENSUS_DEFAULT_RECIPIENTS } from '@/constants/email';
import { saveAppSetting } from '@/services/settingsService';
import {
  CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST,
  type GlobalEmailRecipientList,
} from '@/services/email/emailRecipientListService';
import type { CensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import { resolveStoredRecipientSelection } from '@/hooks/controllers/censusEmailRecipientSelectionController';
import {
  type RecipientRuntimeState,
  resolveRecipientMutationFailureMessage,
  resolveRecipientSelectionRuntimeState,
  resolveRecipientSyncState,
} from '@/hooks/controllers/censusEmailRecipientRuntimeController';
import { resolveRecipientListForSelection } from '@/hooks/controllers/censusEmailRecipientMutationController';
import {
  resolveRecipientRuntimeAfterCreate,
  resolveRecipientRuntimeAfterDeleteOutcome,
  resolveRecipientRuntimeAfterRename,
} from '@/hooks/controllers/censusEmailRecipientMutationRuntimeController';
import { resolveDeferredRecipientSyncInput } from '@/hooks/controllers/censusEmailRecipientSyncController';
import {
  type CensusRecipientListUseCasesModule,
  type RecipientUseCaseResult,
  withRecipientListUseCases,
} from '@/hooks/controllers/censusEmailRecipientUseCaseLoader';

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

  const runRecipientRuntimeMutation = useCallback(
    async <T>(
      execute: () => Promise<{
        status: string;
        data?: T;
        issues?: Array<{ message?: string; userSafeMessage?: string }>;
        userSafeMessage?: string;
      }>,
      {
        resolveRuntimeState,
        fallbackMessage,
      }: {
        resolveRuntimeState: (data: NonNullable<T>) => RecipientRuntimeState | null;
        fallbackMessage: string;
      }
    ) => {
      await runRecipientListMutation(execute, {
        onSuccess: result => {
          const nextState = resolveRuntimeState(result);
          if (nextState) {
            applyRecipientRuntimeStateWithPersistence(nextState);
          }
        },
        fallbackMessage,
      });
    },
    [applyRecipientRuntimeStateWithPersistence, runRecipientListMutation]
  );

  const executeRecipientRuntimeMutation = useCallback(
    async <T>(
      runUseCase: (
        useCases: CensusRecipientListUseCasesModule
      ) => Promise<RecipientUseCaseResult<T>>,
      options: {
        resolveRuntimeState: (data: NonNullable<T>) => RecipientRuntimeState | null;
        fallbackMessage: string;
      }
    ) => {
      await runRecipientRuntimeMutation(() => withRecipientListUseCases(runUseCase), options);
    },
    [runRecipientRuntimeMutation]
  );

  useEffect(() => {
    let isActive = true;

    const loadRecipients = async () => {
      const runtimeResult = await withRecipientListUseCases(
        ({ executeLoadCensusRecipientRuntimeState }) =>
          executeLoadCensusRecipientRuntimeState({
            canManageGlobalRecipientLists,
            browserRuntime,
            enabled,
            activeListStorageKey: RECIPIENT_LIST_KEY,
            recipientsStorageKey: RECIPIENTS_STORAGE_KEY,
            user,
          })
      );

      if (!isActive) return;

      if (runtimeResult.status === 'success' && runtimeResult.data) {
        applyRecipientRuntimeState(runtimeResult.data);
      }
    };

    void loadRecipients();

    return () => {
      isActive = false;
    };
  }, [browserRuntime, canManageGlobalRecipientLists, enabled, applyRecipientRuntimeState, user]);

  useEffect(() => {
    if (!recipientsReadyRef.current) return;
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
      if (!syncInput) return;

      setIsRecipientsSyncing(true);
      setRecipientsSyncError(null);

      void withRecipientListUseCases(({ executeSyncCensusRecipientList }) =>
        executeSyncCensusRecipientList(syncInput)
      )
        .then(result => {
          if (cancelled) return;
          applyRecipientSyncState(resolveRecipientSyncState(result, recipients));
        })
        .finally(() => {
          if (!cancelled) setIsRecipientsSyncing(false);
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
    applyRecipientSyncState,
  ]);

  const createRecipientList = useCallback(
    async (name: string) => {
      await executeRecipientRuntimeMutation(
        ({ executeCreateCensusRecipientList }) =>
          executeCreateCensusRecipientList({
            canManageGlobalRecipientLists,
            name,
            recipients,
            recipientLists,
            actor: user,
          }),
        {
          resolveRuntimeState: result => resolveRecipientRuntimeAfterCreate(recipientLists, result),
          fallbackMessage: 'No se pudo crear la nueva lista global.',
        }
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
        ({ executeRenameCensusRecipientList }) =>
          executeRenameCensusRecipientList({
            canManageGlobalRecipientLists,
            activeList: resolveRecipientListForSelection(recipientLists, activeRecipientListId),
            name,
            recipients,
            actor: user,
          }),
        {
          resolveRuntimeState: result => resolveRecipientRuntimeAfterRename(recipientLists, result),
          fallbackMessage: 'No se pudo actualizar el nombre de la lista global.',
        }
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
        ({ executeDeleteCensusRecipientList }) =>
          executeDeleteCensusRecipientList({
            canManageGlobalRecipientLists,
            recipientLists,
            listId,
          }),
        {
          resolveRuntimeState: result =>
            resolveRecipientRuntimeAfterDeleteOutcome({
              recipientLists,
              listId,
              fallbackList: result.fallbackList,
            }),
          fallbackMessage: 'No se pudo eliminar la lista global seleccionada.',
        }
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
