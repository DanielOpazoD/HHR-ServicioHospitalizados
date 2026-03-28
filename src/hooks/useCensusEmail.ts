import { useState, useCallback } from 'react';
import { useConfirmDialog } from '@/context/UIContext';
import type { DailyRecord } from '@/hooks/contracts/dailyRecordHookContracts';
import { defaultCensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import type { GlobalEmailRecipientList } from '@/services/email/emailRecipientListService';
import {
  canManageGlobalCensusEmailRecipients,
  canUseAdminMaintenanceActions,
} from '@/shared/access/operationalAccessPolicy';
import { useCensusEmailDeliveryActions } from '@/hooks/useCensusEmailDeliveryActions';
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

  // Test mode
  testModeEnabled: boolean;
  setTestModeEnabled: (value: boolean) => void;
  testRecipient: string;
  setTestRecipient: (value: string) => void;
  isAdminUser: boolean;
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
  const isAdminUser = canUseAdminMaintenanceActions(role);
  const browserRuntime = defaultCensusEmailBrowserRuntime;
  const canManageGlobalRecipientLists = canManageGlobalCensusEmailRecipients({
    role,
    userId: user?.uid || user?.email || null,
  });

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
  const testModeEnabled = isAdminUser ? testModeEnabledState : false;
  const testRecipient = isAdminUser ? testRecipientState : '';
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

  // ========== UI STATE ==========
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const { status, error, setStatus, setError, resetStatus } =
    useCensusEmailSendState(currentDateString);

  // ========== HANDLERS ==========
  const { sendEmail } = useCensusEmailDeliveryActions({
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
    setStatus,
    setError,
    confirm,
    alert,
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
    testModeEnabled,
    setTestModeEnabled,
    testRecipient,
    setTestRecipient,
    isAdminUser,
  };
};
