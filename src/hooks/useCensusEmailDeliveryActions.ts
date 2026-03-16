import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ConfirmOptions } from '@/context/uiContracts';
import type { CensusAccessRole } from '@/types/censusAccess';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { CensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import { type CensusEmailExcelSheetConfig } from '@/hooks/controllers/censusExcelSheetController';
import {
  buildSendCensusConfirmationMessage,
  executeGenerateCensusShareLink,
  executeSendCensusEmail,
  executeSendCensusEmailWithLink,
} from '@/application/census-email/sendCensusEmailUseCases';
import {
  buildClipboardCopyMessage,
  canRunCensusEmailAction,
  resolveShareLinkRole,
} from '@/hooks/controllers/censusEmailActionController';
import { resolveCensusEmailSendOutcomePresentation } from '@/hooks/controllers/censusEmailOutcomeController';

export type CensusEmailSendStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseCensusEmailDeliveryActionsParams {
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

export const useCensusEmailDeliveryActions = ({
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
}: UseCensusEmailDeliveryActionsParams) => {
  const generateShareLink = useCallback(
    async (_accessRole: CensusAccessRole = 'viewer'): Promise<string | null> => {
      const result = await executeGenerateCensusShareLink(browserRuntime);
      if (result.status === 'success') {
        return result.data;
      }
      await alert(result.issues[0]?.message || 'No se pudo generar el link de acceso.');
      return null;
    },
    [alert, browserRuntime]
  );

  const sendEmail = useCallback(async () => {
    if (!canRunCensusEmailAction(status)) return;
    const confirmed = await confirm({
      title: 'Confirmar Envío de Censo',
      message: buildSendCensusConfirmationMessage({
        currentDateString,
        recipients,
        testModeEnabled,
        testRecipient,
        isAdminUser,
      }),
      confirmText: 'Aceptar',
      cancelText: 'Cancelar',
      variant: 'info',
    });
    if (!confirmed) return;

    setError(null);
    setStatus('loading');

    const result = await executeSendCensusEmail({
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
    });

    const presentation = resolveCensusEmailSendOutcomePresentation(result, {
      fallbackErrorMessage: 'No se pudo enviar el correo.',
      partialTitle: 'Envío completado con advertencias',
      errorTitle: 'Error al enviar',
      validationTitle: 'Modo prueba',
      shouldUseValidationTitle: isAdminUser && testModeEnabled,
    });

    setError(presentation.error);
    setStatus(presentation.nextStatus);
    if (presentation.alertMessage) {
      await alert(presentation.alertMessage, presentation.alertTitle);
    }
  }, [
    alert,
    confirm,
    currentDateString,
    excelSheetConfig,
    isAdminUser,
    message,
    nurseSignature,
    recipients,
    record,
    role,
    selectedDay,
    selectedMonth,
    selectedYear,
    setError,
    setStatus,
    status,
    testModeEnabled,
    testRecipient,
    user,
  ]);

  const sendEmailWithLink = useCallback(
    async (accessRole: CensusAccessRole = 'viewer') => {
      if (!canRunCensusEmailAction(status)) return;
      const confirmed = await confirm({
        title: 'Enviar Link de Acceso',
        message:
          '¿Estás seguro de enviar un link de acceso seguro a los destinatarios configurados?\n\nEsto permitirá a los usuarios visualizar el censo sin necesidad de archivos Excel.',
        confirmText: 'Aceptar',
        cancelText: 'Cancelar',
        variant: 'info',
      });
      if (!confirmed) return;

      setStatus('loading');
      setError(null);

      const result = await executeSendCensusEmailWithLink({
        record,
        currentDateString,
        nurseSignature,
        user,
        role,
        recipients,
        message,
        accessRole: resolveShareLinkRole(accessRole),
        browserRuntime,
      });
      const presentation = resolveCensusEmailSendOutcomePresentation(result, {
        fallbackErrorMessage: 'Error al enviar link.',
        partialTitle: 'Link enviado con advertencias',
        errorTitle: 'Error al enviar link',
      });
      setError(presentation.error);
      setStatus(presentation.nextStatus);
      if (presentation.alertMessage) {
        await alert(presentation.alertMessage, presentation.alertTitle);
      }
    },
    [
      alert,
      browserRuntime,
      confirm,
      currentDateString,
      message,
      nurseSignature,
      recipients,
      record,
      role,
      setError,
      setStatus,
      status,
      user,
    ]
  );

  const copyShareLink = useCallback(
    async (accessRole: CensusAccessRole = 'viewer') => {
      const link = await generateShareLink(resolveShareLinkRole(accessRole));
      if (link) {
        try {
          await browserRuntime.writeClipboard(link);
          await alert(buildClipboardCopyMessage(link), 'Link Copiado');
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
