import type { ConfirmOptions } from '@/context/uiContracts';
import type { CensusAccessRole } from '@/types/censusAccess';
import type { DailyRecord } from '@/types';
import { formatDateDDMMYYYY as formatDate } from '@/utils/dateUtils';
import { getMonthRecordsFromFirestore } from '@/services/storage/firestoreService';
import { initializeDay } from '@/services/repositories/DailyRecordRepository';
import { triggerCensusEmail } from '@/services/integrations/censusEmailService';
import { uploadCensus } from '@/services/backup/censusStorageService';
import type { CensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import { buildSharedCensusLink } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import { CENSUS_DEFAULT_RECIPIENTS } from '@/constants/email';
import { resolveSendingRecipients } from '@/hooks/controllers/censusEmailRecipientsController';
import {
  buildCensusWorkbookPlan,
  type CensusEmailExcelSheetConfig,
} from '@/hooks/controllers/censusExcelSheetController';
import {
  buildCensusEmailConfirmationText,
  buildMonthIntegrityDates,
  resolveFinalCensusEmailMessage,
  resolveMonthRecordsForDelivery,
} from '@/hooks/controllers/censusEmailSendController';

interface SharedCensusEmailDependencies {
  currentDateString: string;
  nurseSignature: string;
  record: DailyRecord | null;
  recipients: string[];
  message: string;
  role: string;
  user: { uid?: string; email?: string | null; role?: string } | null;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (message: string, title?: string) => Promise<void>;
  setStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
  setError: (error: string | null) => void;
}

interface DeliverCensusEmailParams extends SharedCensusEmailDependencies {
  selectedYear: number;
  selectedMonth: number;
  selectedDay: number;
  testModeEnabled: boolean;
  testRecipient: string;
  isAdminUser: boolean;
  excelSheetConfig: CensusEmailExcelSheetConfig;
}

interface DeliverCensusEmailWithLinkParams extends SharedCensusEmailDependencies {
  browserRuntime: CensusEmailBrowserRuntime;
  accessRole?: CensusAccessRole;
}

export const generateCensusShareLink = async (
  browserRuntime: CensusEmailBrowserRuntime,
  alert: (message: string, title?: string) => Promise<void>
) => {
  try {
    const origin = browserRuntime.getOrigin();
    if (!origin) {
      throw new Error('No se pudo resolver el origen de la aplicación.');
    }

    return buildSharedCensusLink(origin);
  } catch (error) {
    console.error('Error generating share link', error);
    await alert('No se pudo generar el link de acceso.');
    return null;
  }
};

export const deliverCensusEmail = async ({
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
}: DeliverCensusEmailParams) => {
  if (!record) {
    await alert('No hay datos del censo para enviar.');
    return;
  }

  const recipientsResult = resolveSendingRecipients({
    recipients,
    shouldUseTestMode: isAdminUser && testModeEnabled,
    testRecipient,
  });
  if (!recipientsResult.ok) {
    setError(recipientsResult.error);
    await alert(recipientsResult.error, 'Modo prueba');
    return;
  }

  const confirmed = await confirm({
    title: 'Confirmar Envío de Censo',
    message: buildCensusEmailConfirmationText({
      currentDateString,
      recipients: recipientsResult.recipients,
      shouldUseTestMode: isAdminUser && testModeEnabled,
      formatDate,
    }),
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    variant: 'info',
  });
  if (!confirmed) {
    return;
  }

  setError(null);
  setStatus('loading');

  try {
    const integrityDates = buildMonthIntegrityDates({
      year: selectedYear,
      monthZeroBased: selectedMonth,
      day: selectedDay,
    });

    for (let index = 0; index < integrityDates.length; index += 1) {
      const date = integrityDates[index];
      const previousDate = index > 0 ? integrityDates[index - 1] : undefined;
      try {
        await initializeDay(date, previousDate);
      } catch (errorOnInitialize) {
        console.warn(`[useCensusEmail] Failed to initialize day ${date}:`, errorOnInitialize);
      }
    }

    const finalMessage = resolveFinalCensusEmailMessage({
      message,
      currentDateString,
      nurseSignature,
    });
    const monthRecords = await getMonthRecordsFromFirestore(selectedYear, selectedMonth);
    const filteredRecords = resolveMonthRecordsForDelivery({
      monthRecords,
      currentRecord: record,
      currentDateString,
      selectedYear,
      selectedMonth,
      selectedDay,
    });
    const workbookPlan = buildCensusWorkbookPlan({
      monthRecords: filteredRecords,
      currentDateString,
      config: excelSheetConfig,
    });

    await triggerCensusEmail({
      date: currentDateString,
      records: workbookPlan.records,
      sheetDescriptors: workbookPlan.sheetDescriptors,
      recipients: recipientsResult.recipients,
      nursesSignature: nurseSignature || undefined,
      body: finalMessage,
      userEmail: user?.email,
      userRole: user?.role || role,
    });

    try {
      const { buildCensusMasterWorkbook } =
        await import('@/services/exporters/censusMasterWorkbook');
      const workbook = await buildCensusMasterWorkbook(workbookPlan.records, {
        sheetDescriptors: workbookPlan.sheetDescriptors,
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const excelBlob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      await uploadCensus(excelBlob, currentDateString);
    } catch (backupError) {
      console.error('[useCensusEmail] Cloud backup failed (but email was sent):', backupError);
    }

    setStatus('success');
  } catch (error: unknown) {
    console.error('Error enviando correo de censo', error);
    const errorMessage = (error as { message?: string })?.message || 'No se pudo enviar el correo.';
    setError(errorMessage);
    setStatus('error');
    await alert(errorMessage, 'Error al enviar');
  }
};

export const deliverCensusEmailWithLink = async ({
  record,
  currentDateString,
  nurseSignature,
  user,
  role,
  recipients,
  message,
  browserRuntime,
  accessRole = 'viewer',
  confirm,
  alert,
  setStatus,
  setError,
}: DeliverCensusEmailWithLinkParams) => {
  if (!record) {
    await alert('No hay datos del censo para enviar.');
    return;
  }

  const confirmed = await confirm({
    title: 'Enviar Link de Acceso',
    message:
      '¿Estás seguro de enviar un link de acceso seguro a los destinatarios configurados?\n\nEsto permitirá a los usuarios visualizar el censo sin necesidad de archivos Excel.',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    variant: 'info',
  });
  if (!confirmed) {
    return;
  }

  setStatus('loading');
  setError(null);

  try {
    const shareLink = await generateCensusShareLink(browserRuntime, alert);
    if (!shareLink) {
      throw new Error('No se pudo generar el link.');
    }

    const recipientsResult = resolveSendingRecipients({
      recipients,
      shouldUseTestMode: false,
      testRecipient: '',
    });
    const resolvedRecipients = recipientsResult.ok
      ? recipientsResult.recipients
      : CENSUS_DEFAULT_RECIPIENTS;

    await triggerCensusEmail({
      date: currentDateString,
      records: [record],
      recipients: resolvedRecipients,
      nursesSignature: nurseSignature || undefined,
      body: message,
      shareLink,
      userEmail: user?.email,
      userRole: user?.role || role,
    });

    setStatus('success');
  } catch (error: unknown) {
    console.error('Error sending email with link', error);
    const errorMessage = (error as Error).message || 'Error al enviar link.';
    setError(errorMessage);
    setStatus('error');
    await alert(errorMessage || 'No se pudo enviar el link de acceso.');
  }
};
