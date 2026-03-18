import { useCallback, useEffect, useRef, useState } from 'react';
import { CENSUS_DEFAULT_RECIPIENTS } from '@/constants/email';
import { getAppSetting, saveAppSetting } from '@/services/settingsService';
import {
  areGlobalEmailRecipientsEqual,
  CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST,
  type GlobalEmailRecipientList,
} from '@/services/email/emailRecipientListService';
import type { CensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import {
  executeBootstrapCensusRecipientLists,
  executeCreateCensusRecipientList,
  executeDeleteCensusRecipientList,
  executeRenameCensusRecipientList,
  executeSyncCensusRecipientList,
} from '@/application/census-email/censusRecipientListUseCases';
import { resolveStoredRecipients } from '@/hooks/controllers/censusEmailRecipientsController';
import { resolveApplicationOutcomeMessage } from '@/application/shared/applicationOutcomeMessage';

const RECIPIENT_LIST_KEY = 'censusEmailActiveRecipientListId';

interface UseCensusEmailRecipientListsParams {
  canManageGlobalRecipientLists: boolean;
  browserRuntime: CensusEmailBrowserRuntime;
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

export const useCensusEmailRecipientLists = ({
  canManageGlobalRecipientLists,
  browserRuntime,
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
      void saveAppSetting('censusEmailRecipients', list.recipients);
    },
    [setActiveRecipientListId]
  );

  const upsertRecipientList = useCallback((nextList: GlobalEmailRecipientList) => {
    setRecipientLists(previousLists => {
      const existingIndex = previousLists.findIndex(list => list.id === nextList.id);
      if (existingIndex === -1) {
        return [nextList, ...previousLists];
      }

      const updatedLists = [...previousLists];
      updatedLists[existingIndex] = nextList;
      return updatedLists;
    });
  }, []);

  const selectActiveRecipientList = useCallback(
    (listId: string) => {
      const activeList = recipientLists.find(list => list.id === listId);
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

  useEffect(() => {
    let isActive = true;

    const loadRecipients = async () => {
      const bootstrapResult = await executeBootstrapCensusRecipientLists({
        canManageGlobalRecipientLists,
        browserRuntime,
        activeListStorageKey: RECIPIENT_LIST_KEY,
        user,
      });

      if (!isActive) {
        return;
      }

      if (bootstrapResult.status === 'success' && bootstrapResult.data) {
        const bootstrap = bootstrapResult.data;
        setRecipientLists(bootstrap.recipientLists);
        if (bootstrap.activeRecipientList) {
          applyActiveRecipientList(bootstrap.activeRecipientList);
        } else {
          setRecipientsState(bootstrap.recipients);
          setRecipientsSource(bootstrap.recipientsSource);
          setRecipientsSyncError(bootstrap.syncError);
        }
        recipientsReadyRef.current = true;
        return;
      }

      const stored = await getAppSetting<string[] | null>('censusEmailRecipients', null);
      const storedRecipients = resolveStoredRecipients(stored) ?? CENSUS_DEFAULT_RECIPIENTS;
      if (!isActive) {
        return;
      }

      setRecipientsState(storedRecipients);
      setRecipientsSource(storedRecipients.length > 0 ? 'local' : 'default');
      setRecipientsSyncError(
        resolveApplicationOutcomeMessage(
          bootstrapResult,
          'No se pudo cargar la lista global en Firebase. Se usara la copia local.'
        )
      );
      recipientsReadyRef.current = true;
    };

    void loadRecipients();

    return () => {
      isActive = false;
    };
  }, [applyActiveRecipientList, browserRuntime, canManageGlobalRecipientLists, user]);

  useEffect(() => {
    if (!recipientsReadyRef.current) {
      return;
    }

    void saveAppSetting('censusEmailRecipients', recipients);
  }, [recipients]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsRecipientsSyncing(true);
      setRecipientsSyncError(null);

      void executeSyncCensusRecipientList({
        canManageGlobalRecipientLists,
        recipientsReady: recipientsReadyRef.current,
        recipients,
        lastRemoteRecipients: lastRemoteRecipientsRef.current,
        recipientLists,
        activeRecipientListId: activeRecipientListIdRef.current,
        actor: user,
      })
        .then(result => {
          if (cancelled) {
            return;
          }
          if (result.status === 'success') {
            if (!result.data.skipped) {
              lastRemoteRecipientsRef.current = recipients;
              setRecipientsSource('firebase');
            }
            return;
          }

          setRecipientsSyncError(
            resolveApplicationOutcomeMessage(
              result,
              'No se pudo sincronizar la lista global en Firebase. Se mantiene la copia local.'
            )
          );
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
  }, [activeRecipientListId, canManageGlobalRecipientLists, recipientLists, recipients, user]);

  const createRecipientList = useCallback(
    async (name: string) => {
      setIsRecipientsSyncing(true);
      setRecipientsSyncError(null);
      const result = await executeCreateCensusRecipientList({
        canManageGlobalRecipientLists,
        name,
        recipients,
        recipientLists,
        actor: user,
      });

      if (result.status === 'success' && result.data) {
        upsertRecipientList(result.data);
        applyActiveRecipientList(result.data);
      } else {
        setRecipientsSyncError(
          resolveApplicationOutcomeMessage(result, 'No se pudo crear la nueva lista global.')
        );
      }
      setIsRecipientsSyncing(false);
    },
    [
      applyActiveRecipientList,
      canManageGlobalRecipientLists,
      recipientLists,
      recipients,
      upsertRecipientList,
      user,
    ]
  );

  const renameActiveRecipientList = useCallback(
    async (name: string) => {
      setIsRecipientsSyncing(true);
      setRecipientsSyncError(null);
      const result = await executeRenameCensusRecipientList({
        canManageGlobalRecipientLists,
        activeList: recipientLists.find(list => list.id === activeRecipientListId),
        name,
        recipients,
        actor: user,
      });

      if (result.status === 'success' && result.data) {
        upsertRecipientList(result.data);
      } else {
        setRecipientsSyncError(
          resolveApplicationOutcomeMessage(
            result,
            'No se pudo actualizar el nombre de la lista global.'
          )
        );
      }
      setIsRecipientsSyncing(false);
    },
    [
      activeRecipientListId,
      canManageGlobalRecipientLists,
      recipientLists,
      recipients,
      upsertRecipientList,
      user,
    ]
  );

  const deleteRecipientList = useCallback(
    async (listId: string) => {
      setIsRecipientsSyncing(true);
      setRecipientsSyncError(null);
      const result = await executeDeleteCensusRecipientList({
        canManageGlobalRecipientLists,
        recipientLists,
        listId,
      });

      if (result.status === 'success') {
        const fallbackList = result.data.fallbackList;
        setRecipientLists(previousLists => previousLists.filter(list => list.id !== listId));
        if (fallbackList) {
          setActiveRecipientListId(fallbackList.id);
        }
      } else {
        setRecipientsSyncError(
          resolveApplicationOutcomeMessage(
            result,
            'No se pudo eliminar la lista global seleccionada.'
          )
        );
      }
      setIsRecipientsSyncing(false);
    },
    [canManageGlobalRecipientLists, recipientLists, setActiveRecipientListId]
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
