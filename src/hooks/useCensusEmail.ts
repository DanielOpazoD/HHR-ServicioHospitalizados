import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useConfirmDialog } from '@/context/UIContext';
import { DailyRecord } from '@/types';
import { CENSUS_DEFAULT_RECIPIENTS } from '@/constants/email';
import { getAppSetting, saveAppSetting } from '@/services/settingsService';
import { isAdmin } from '@/utils/permissions';
import { CensusAccessRole } from '@/types/censusAccess';
import { defaultCensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import {
  CENSUS_EMAIL_EXCEL_SHEET_CONFIG_KEY,
  DEFAULT_CENSUS_EMAIL_EXCEL_SHEET_CONFIG,
  normalizeCensusEmailExcelSheetConfig,
  type CensusEmailExcelSheetConfig,
} from '@/hooks/controllers/censusExcelSheetController';
import {
  resolveLegacyRecipients,
  resolveStoredRecipients,
} from '@/hooks/controllers/censusEmailRecipientsController';
import { useCensusEmailActions, type CensusEmailSendStatus } from '@/hooks/useCensusEmailActions';
import {
  areGlobalEmailRecipientsEqual,
  buildGlobalEmailRecipientListId,
  CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST,
  deleteGlobalEmailRecipientList,
  ensureGlobalEmailRecipientList,
  getGlobalEmailRecipientLists,
  GlobalEmailRecipientList,
  saveGlobalEmailRecipientList,
  subscribeToGlobalEmailRecipientLists,
} from '@/services/email/emailRecipientListService';
import {
  createInitialCensusMessageState,
  createInitialCensusSendState,
  resolveCensusEmailMessage,
  resolveDateBoundSendState,
  updateDateBoundErrorState,
  updateDateBoundStatusState,
} from '@/hooks/controllers/censusEmailStateController';

interface UseCensusEmailParams {
  record: DailyRecord | null;
  currentDateString: string;
  nurseSignature: string;
  selectedYear: number;
  selectedMonth: number;
  selectedDay: number;
  user: { uid?: string; email?: string | null; role?: string } | null;
  role: string;
}

export interface UseCensusEmailReturn {
  // Config modal state
  showEmailConfig: boolean;
  setShowEmailConfig: (show: boolean) => void;

  // Recipients
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

  // Message
  message: string;
  onMessageChange: (value: string) => void;
  onResetMessage: () => void;

  // Send state
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;

  // Actions
  resetStatus: () => void;
  sendEmail: () => Promise<void>;
  sendEmailWithLink: (role?: CensusAccessRole) => Promise<void>;
  generateShareLink: (role?: CensusAccessRole) => Promise<string | null>;
  copyShareLink: (role?: CensusAccessRole) => Promise<void>;

  // Test mode
  testModeEnabled: boolean;
  setTestModeEnabled: (value: boolean) => void;
  testRecipient: string;
  setTestRecipient: (value: string) => void;
  isAdminUser: boolean;

  // Excel options for current day sheets
  excelSheetConfig: CensusEmailExcelSheetConfig;
  setExcelSheetConfig: (value: CensusEmailExcelSheetConfig) => void;
}

/**
 * Hook to manage census email configuration and sending.
 * Extracts email handling logic from App.tsx for cleaner separation of concerns.
 */
export const useCensusEmail = ({
  record,
  currentDateString,
  nurseSignature,
  selectedYear,
  selectedMonth,
  selectedDay,
  user,
  role,
}: UseCensusEmailParams): UseCensusEmailReturn => {
  const { confirm, alert } = useConfirmDialog();
  const isAdminUser = isAdmin(role);
  const browserRuntime = defaultCensusEmailBrowserRuntime;

  // ========== RECIPIENTS STATE ==========
  const [recipients, setRecipients] = useState<string[]>(CENSUS_DEFAULT_RECIPIENTS);
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
  const RECIPIENT_LIST_KEY = 'censusEmailActiveRecipientListId';

  const setActiveRecipientListId = useCallback((listId: string) => {
    activeRecipientListIdRef.current = listId;
    setActiveRecipientListIdState(listId);
    void saveAppSetting(RECIPIENT_LIST_KEY, listId);
  }, []);

  const applyActiveRecipientList = useCallback(
    (list: GlobalEmailRecipientList) => {
      setActiveRecipientListId(list.id);
      lastRemoteRecipientsRef.current = list.recipients;
      recipientsReadyRef.current = true;
      setRecipientsSource('firebase');
      setRecipientsSyncError(null);
      setRecipients(currentRecipients =>
        areGlobalEmailRecipientsEqual(currentRecipients, list.recipients)
          ? currentRecipients
          : list.recipients
      );
      void saveAppSetting('censusEmailRecipients', list.recipients);
    },
    [setActiveRecipientListId]
  );

  useEffect(() => {
    let isActive = true;

    const loadRecipients = async () => {
      const stored = await getAppSetting<string[] | null>('censusEmailRecipients', null);
      const storedActiveListId = await getAppSetting<string | null>(RECIPIENT_LIST_KEY, null);
      const storedRecipients = resolveStoredRecipients(stored);
      let seedRecipients = storedRecipients ?? null;

      if (!seedRecipients) {
        const legacyRecipients = resolveLegacyRecipients(browserRuntime.getLegacyRecipients());
        if (legacyRecipients) {
          seedRecipients = legacyRecipients;
          await saveAppSetting('censusEmailRecipients', legacyRecipients);
          browserRuntime.clearLegacyRecipients();
        }
      }

      let lists = await getGlobalEmailRecipientLists();

      if (lists.length === 0) {
        await ensureGlobalEmailRecipientList({
          listId: CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id,
          name: CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.name,
          description: CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.description,
          recipients: seedRecipients ?? CENSUS_DEFAULT_RECIPIENTS,
          updatedByUid: user?.uid ?? null,
          updatedByEmail: user?.email ?? null,
        });
        lists = await getGlobalEmailRecipientLists();
      }

      if (lists.length > 0) {
        const preferredListId =
          storedActiveListId && lists.some(list => list.id === storedActiveListId)
            ? storedActiveListId
            : lists.some(list => list.id === CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id)
              ? CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id
              : lists[0].id;
        const activeList = lists.find(list => list.id === preferredListId) ?? lists[0];

        if (isActive) {
          setRecipientLists(lists);
          applyActiveRecipientList(activeList);
        }
        return;
      }

      if (storedRecipients) {
        if (isActive) {
          setRecipients(storedRecipients);
          setRecipientsSource('local');
          setRecipientsSyncError(null);
        }
        recipientsReadyRef.current = true;
        return;
      }

      if (isActive) {
        setRecipients(CENSUS_DEFAULT_RECIPIENTS);
        setRecipientsSource('default');
      }
      recipientsReadyRef.current = true;
    };

    void loadRecipients();

    return () => {
      isActive = false;
    };
  }, [RECIPIENT_LIST_KEY, applyActiveRecipientList, browserRuntime, user?.email, user?.uid]);

  useEffect(() => {
    const unsubscribe = subscribeToGlobalEmailRecipientLists(lists => {
      setRecipientLists(lists);

      if (lists.length === 0) {
        return;
      }

      const nextActiveList =
        lists.find(list => list.id === activeRecipientListIdRef.current) ??
        lists.find(list => list.id === CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id) ??
        lists[0];

      applyActiveRecipientList(nextActiveList);
    });

    return unsubscribe;
  }, [applyActiveRecipientList]);

  useEffect(() => {
    const activeList = recipientLists.find(list => list.id === activeRecipientListId);
    if (!activeList) {
      return;
    }

    applyActiveRecipientList(activeList);
  }, [activeRecipientListId, applyActiveRecipientList, recipientLists]);

  // ========== MESSAGE STATE ==========
  // Message is always generated dynamically based on date and nurses
  // No localStorage persistence to ensure it always reflects current data
  const [messageState, setMessageState] = useState<{
    key: string;
    value: string;
    edited: boolean;
  }>(() => createInitialCensusMessageState(currentDateString, nurseSignature));
  const message = useMemo(
    () => resolveCensusEmailMessage(messageState, currentDateString, nurseSignature),
    [currentDateString, nurseSignature, messageState]
  );

  // ========== TEST MODE (ADMIN) ==========
  const [testModeEnabledState, setTestModeEnabledState] = useState(false);
  const [testRecipientState, setTestRecipientState] = useState('');
  const [excelSheetConfigState, setExcelSheetConfigState] = useState<CensusEmailExcelSheetConfig>(
    DEFAULT_CENSUS_EMAIL_EXCEL_SHEET_CONFIG
  );
  const testModeEnabled = isAdminUser ? testModeEnabledState : false;
  const testRecipient = isAdminUser ? testRecipientState : '';
  const excelSheetConfig = excelSheetConfigState;
  const setTestModeEnabled = useCallback(
    (value: boolean) => {
      if (isAdminUser) {
        setTestModeEnabledState(value);
      }
    },
    [isAdminUser]
  );
  const setTestRecipient = useCallback(
    (value: string) => {
      if (isAdminUser) {
        setTestRecipientState(value);
      }
    },
    [isAdminUser]
  );
  const setExcelSheetConfig = useCallback((value: CensusEmailExcelSheetConfig) => {
    setExcelSheetConfigState(normalizeCensusEmailExcelSheetConfig(value));
  }, []);

  // ========== UI STATE ==========
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [sendState, setSendState] = useState<{
    key: string;
    status: CensusEmailSendStatus;
    error: string | null;
  }>(() => createInitialCensusSendState(currentDateString));
  const { status, error } = useMemo(
    () => resolveDateBoundSendState(sendState, currentDateString),
    [currentDateString, sendState]
  );
  const setStatus = useCallback(
    (next: React.SetStateAction<CensusEmailSendStatus>) => {
      setSendState(previous => {
        const previousStatus = previous.key === currentDateString ? previous.status : 'idle';
        const nextStatus =
          typeof next === 'function'
            ? (next as (prev: CensusEmailSendStatus) => CensusEmailSendStatus)(previousStatus)
            : next;
        return updateDateBoundStatusState(previous, currentDateString, nextStatus);
      });
    },
    [currentDateString]
  );
  const setError = useCallback(
    (next: React.SetStateAction<string | null>) => {
      setSendState(previous => {
        const previousError = previous.key === currentDateString ? previous.error : null;
        const nextError =
          typeof next === 'function'
            ? (next as (prev: string | null) => string | null)(previousError)
            : next;
        return updateDateBoundErrorState(previous, currentDateString, nextError);
      });
    },
    [currentDateString]
  );

  // ========== PERSISTENCE EFFECTS ==========
  useEffect(() => {
    if (!recipientsReadyRef.current) {
      return;
    }

    void saveAppSetting('censusEmailRecipients', recipients);
  }, [recipients]);

  useEffect(() => {
    if (!recipientsReadyRef.current) {
      return;
    }

    if (areGlobalEmailRecipientsEqual(recipients, lastRemoteRecipientsRef.current)) {
      return;
    }

    let cancelled = false;

    setIsRecipientsSyncing(true);
    setRecipientsSyncError(null);

    const timeoutId = window.setTimeout(() => {
      const activeList =
        recipientLists.find(list => list.id === activeRecipientListIdRef.current) ??
        recipientLists.find(list => list.id === CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id) ??
        null;

      void saveGlobalEmailRecipientList({
        listId: activeList?.id ?? CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.id,
        name: activeList?.name ?? CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.name,
        description: activeList?.description ?? CENSUS_GLOBAL_EMAIL_RECIPIENT_LIST.description,
        recipients,
        updatedByUid: user?.uid ?? null,
        updatedByEmail: user?.email ?? null,
      })
        .then(() => {
          if (cancelled) {
            return;
          }

          lastRemoteRecipientsRef.current = recipients;
          setRecipientsSource('firebase');
        })
        .catch(error => {
          if (cancelled) {
            return;
          }

          console.error('[useCensusEmail] Failed to sync recipients list:', error);
          setRecipientsSyncError(
            'No se pudo sincronizar la lista global en Firebase. Se mantiene la copia local.'
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
  }, [recipientLists, recipients, user?.email, user?.uid]);

  const createRecipientList = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setRecipientsSyncError('Debes ingresar un nombre para la nueva lista.');
        return;
      }

      const nextListId = buildGlobalEmailRecipientListId(
        trimmedName,
        recipientLists.map(list => list.id)
      );
      setIsRecipientsSyncing(true);
      setRecipientsSyncError(null);

      try {
        await saveGlobalEmailRecipientList({
          listId: nextListId,
          name: trimmedName,
          description: `Lista global creada desde el modulo de correo de censo: ${trimmedName}.`,
          recipients,
          updatedByUid: user?.uid ?? null,
          updatedByEmail: user?.email ?? null,
        });
        setActiveRecipientListId(nextListId);
      } catch (error) {
        console.error('[useCensusEmail] Failed to create recipient list:', error);
        setRecipientsSyncError('No se pudo crear la nueva lista global.');
      } finally {
        setIsRecipientsSyncing(false);
      }
    },
    [recipientLists, recipients, setActiveRecipientListId, user?.email, user?.uid]
  );

  const renameActiveRecipientList = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();
      const activeList = recipientLists.find(list => list.id === activeRecipientListId);

      if (!activeList || !trimmedName) {
        setRecipientsSyncError('Debes ingresar un nombre valido para la lista.');
        return;
      }

      setIsRecipientsSyncing(true);
      setRecipientsSyncError(null);

      try {
        await saveGlobalEmailRecipientList({
          listId: activeList.id,
          name: trimmedName,
          description: activeList.description,
          recipients,
          updatedByUid: user?.uid ?? null,
          updatedByEmail: user?.email ?? null,
        });
      } catch (error) {
        console.error('[useCensusEmail] Failed to rename recipient list:', error);
        setRecipientsSyncError('No se pudo actualizar el nombre de la lista global.');
      } finally {
        setIsRecipientsSyncing(false);
      }
    },
    [activeRecipientListId, recipientLists, recipients, user?.email, user?.uid]
  );

  const deleteRecipientList = useCallback(
    async (listId: string) => {
      if (recipientLists.length <= 1) {
        setRecipientsSyncError('Debe existir al menos una lista global de correos.');
        return;
      }

      const fallbackList = recipientLists.find(list => list.id !== listId);
      if (!fallbackList) {
        setRecipientsSyncError('No se encontro una lista alternativa para mantener activa.');
        return;
      }

      setIsRecipientsSyncing(true);
      setRecipientsSyncError(null);

      try {
        await deleteGlobalEmailRecipientList(listId);
        setActiveRecipientListId(fallbackList.id);
      } catch (error) {
        console.error('[useCensusEmail] Failed to delete recipient list:', error);
        setRecipientsSyncError('No se pudo eliminar la lista global seleccionada.');
      } finally {
        setIsRecipientsSyncing(false);
      }
    },
    [recipientLists, setActiveRecipientListId]
  );

  useEffect(() => {
    const loadExcelSheetConfig = async () => {
      const storedConfig = await getAppSetting<unknown>(
        CENSUS_EMAIL_EXCEL_SHEET_CONFIG_KEY,
        DEFAULT_CENSUS_EMAIL_EXCEL_SHEET_CONFIG
      );
      setExcelSheetConfigState(normalizeCensusEmailExcelSheetConfig(storedConfig));
    };
    loadExcelSheetConfig();
  }, []);

  useEffect(() => {
    saveAppSetting(CENSUS_EMAIL_EXCEL_SHEET_CONFIG_KEY, excelSheetConfig);
  }, [excelSheetConfig]);

  // ========== HANDLERS ==========
  const onMessageChange = useCallback(
    (value: string) => {
      setMessageState({
        key: currentDateString,
        value,
        edited: true,
      });
    },
    [currentDateString]
  );

  const onResetMessage = useCallback(() => {
    setMessageState(createInitialCensusMessageState(currentDateString, nurseSignature));
  }, [currentDateString, nurseSignature]);

  const resetStatus = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, [setError, setStatus]);

  const { sendEmail, sendEmailWithLink, generateShareLink, copyShareLink } = useCensusEmailActions({
    record,
    currentDateString,
    nurseSignature,
    selectedYear,
    selectedMonth,
    selectedDay,
    user,
    role,
    recipients,
    message,
    status,
    testModeEnabled,
    testRecipient,
    isAdminUser,
    excelSheetConfig,
    setStatus,
    setError,
    confirm,
    alert,
    browserRuntime,
  });

  return {
    showEmailConfig,
    setShowEmailConfig,
    recipients,
    setRecipients,
    recipientLists,
    activeRecipientListId,
    setActiveRecipientListId,
    createRecipientList,
    renameActiveRecipientList,
    deleteRecipientList,
    recipientsSource,
    isRecipientsSyncing,
    recipientsSyncError,
    message,
    onMessageChange,
    onResetMessage,
    status,
    error,
    resetStatus,
    sendEmail,
    sendEmailWithLink,
    generateShareLink,
    copyShareLink,
    testModeEnabled,
    setTestModeEnabled,
    testRecipient,
    setTestRecipient,
    isAdminUser,
    excelSheetConfig,
    setExcelSheetConfig,
  };
};
