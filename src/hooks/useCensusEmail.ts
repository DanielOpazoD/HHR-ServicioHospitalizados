import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useConfirmDialog } from '@/context/UIContext';
import { DailyRecord } from '@/types';
import { getAppSetting, saveAppSetting } from '@/services/settingsService';
import { isAdmin } from '@/utils/permissions';
import { CensusAccessRole } from '@/types/censusAccess';
import { defaultCensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import type { GlobalEmailRecipientList } from '@/services/email/emailRecipientListService';
import {
  CENSUS_EMAIL_EXCEL_SHEET_CONFIG_KEY,
  DEFAULT_CENSUS_EMAIL_EXCEL_SHEET_CONFIG,
  normalizeCensusEmailExcelSheetConfig,
  type CensusEmailExcelSheetConfig,
} from '@/hooks/controllers/censusExcelSheetController';
import { useCensusEmailActions, type CensusEmailSendStatus } from '@/hooks/useCensusEmailActions';
import {} from '@/hooks/controllers/censusEmailStateController';
import { useCensusEmailRecipientLists } from '@/hooks/useCensusEmailRecipientLists';
import { useCensusEmailMessageState } from '@/hooks/useCensusEmailMessageState';
import { useCensusEmailSendState } from '@/hooks/useCensusEmailSendState';

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
  const canManageGlobalRecipientLists =
    !!user && (role === 'admin' || role === 'nurse_hospital' || role === 'editor');

  // ========== RECIPIENTS STATE ==========
  const {
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
  } = useCensusEmailRecipientLists({
    canManageGlobalRecipientLists,
    browserRuntime,
    user,
  });

  // ========== MESSAGE STATE ==========
  // Message is always generated dynamically based on date and nurses
  // No localStorage persistence to ensure it always reflects current data
  const { message, onMessageChange, onResetMessage } = useCensusEmailMessageState(
    currentDateString,
    nurseSignature
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
  const { status, error, setStatus, setError, resetStatus } =
    useCensusEmailSendState(currentDateString);

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
