import { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Load recipients from IndexedDB on mount
  useEffect(() => {
    const loadRecipients = async () => {
      const stored = await getAppSetting<string[] | null>('censusEmailRecipients', null);
      const storedRecipients = resolveStoredRecipients(stored);
      if (storedRecipients) {
        setRecipients(storedRecipients);
        return;
      }

      const legacyRecipients = resolveLegacyRecipients(browserRuntime.getLegacyRecipients());
      if (legacyRecipients) {
        setRecipients(legacyRecipients);
        await saveAppSetting('censusEmailRecipients', legacyRecipients);
        browserRuntime.clearLegacyRecipients();
      }
    };
    loadRecipients();
  }, [browserRuntime]);

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
    saveAppSetting('censusEmailRecipients', recipients);
  }, [recipients]);

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
