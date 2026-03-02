import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ConfirmOptions } from '@/context/uiContracts';
import type { CensusAccessRole } from '@/types/censusAccess';
import type { DailyRecord } from '@/types';
import type { CensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import { type CensusEmailExcelSheetConfig } from '@/hooks/controllers/censusExcelSheetController';
import {
  deliverCensusEmail,
  deliverCensusEmailWithLink,
  generateCensusShareLink,
} from '@/hooks/controllers/censusEmailDeliveryController';

export type CensusEmailSendStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseCensusEmailActionsParams {
  record: DailyRecord | null;
  currentDateString: string;
  nurseSignature: string;
  selectedYear: number;
  selectedMonth: number;
  selectedDay: number;
  user: { uid?: string; email?: string | null; role?: string } | null;
  role: string;
  recipients: string[];
  message: string;
  status: CensusEmailSendStatus;
  testModeEnabled: boolean;
  testRecipient: string;
  isAdminUser: boolean;
  excelSheetConfig: CensusEmailExcelSheetConfig;
  setStatus: Dispatch<SetStateAction<CensusEmailSendStatus>>;
  setError: Dispatch<SetStateAction<string | null>>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (message: string, title?: string) => Promise<void>;
  browserRuntime: CensusEmailBrowserRuntime;
}

interface UseCensusEmailActionsResult {
  sendEmail: () => Promise<void>;
  sendEmailWithLink: (role?: CensusAccessRole) => Promise<void>;
  generateShareLink: (role?: CensusAccessRole) => Promise<string | null>;
  copyShareLink: (role?: CensusAccessRole) => Promise<void>;
}

export const useCensusEmailActions = ({
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
}: UseCensusEmailActionsParams): UseCensusEmailActionsResult => {
  const generateShareLink = useCallback(
    async (_accessRole: CensusAccessRole = 'viewer'): Promise<string | null> =>
      generateCensusShareLink(browserRuntime, alert),
    [alert, browserRuntime]
  );

  const sendEmail = useCallback(async () => {
    if (status === 'loading' || status === 'success') return;
    await deliverCensusEmail({
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
      testModeEnabled,
      testRecipient,
      isAdminUser,
      excelSheetConfig,
      setStatus,
      setError,
      confirm,
      alert,
    });
  }, [
    alert,
    confirm,
    currentDateString,
    isAdminUser,
    message,
    nurseSignature,
    recipients,
    record,
    role,
    selectedDay,
    selectedMonth,
    selectedYear,
    excelSheetConfig,
    setError,
    setStatus,
    status,
    testModeEnabled,
    testRecipient,
    user?.email,
    user?.role,
  ]);

  const sendEmailWithLink = useCallback(
    async (accessRole: CensusAccessRole = 'viewer') => {
      if (status === 'loading' || status === 'success') return;
      await deliverCensusEmailWithLink({
        record,
        currentDateString,
        nurseSignature,
        user,
        role,
        recipients,
        message,
        browserRuntime,
        accessRole,
        confirm,
        alert,
        setStatus,
        setError,
      });
    },
    [
      alert,
      confirm,
      currentDateString,
      browserRuntime,
      message,
      nurseSignature,
      recipients,
      record,
      role,
      setError,
      setStatus,
      status,
      user?.email,
      user?.role,
    ]
  );

  const copyShareLink = useCallback(
    async (accessRole: CensusAccessRole = 'viewer') => {
      const link = await generateShareLink(accessRole);
      if (link) {
        try {
          await browserRuntime.writeClipboard(link);
          await alert('Copiado al portapapeles: ' + link, 'Link Copiado');
        } catch (err) {
          console.error('Clipboard error', err);
          await alert('No se pudo copiar el link. Intenta manualmente: ' + link);
        }
      }
    },
    [alert, browserRuntime, generateShareLink]
  );

  return {
    sendEmail,
    sendEmailWithLink,
    generateShareLink,
    copyShareLink,
  };
};
