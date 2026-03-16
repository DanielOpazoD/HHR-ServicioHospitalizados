import type { CensusAccessRole } from '@/types/censusAccess';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { CensusEmailBrowserRuntime } from '@/hooks/controllers/censusEmailBrowserRuntimeController';
import { formatDateDDMMYYYY as formatDate } from '@/utils/dateUtils';
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
import {
  createApplicationFailed,
  createApplicationPartial,
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/application/shared/applicationOutcome';
import {
  defaultDailyRecordReadPort,
  type DailyRecordReadPort,
} from '@/application/ports/dailyRecordPort';
import {
  defaultCensusEmailDeliveryPort,
  type CensusEmailDeliveryPort,
} from '@/application/ports/censusEmailPort';

interface SharedCensusEmailInput {
  currentDateString: string;
  nurseSignature: string;
  record: DailyRecord | null;
  recipients: string[];
  message: string;
  role: string;
  user: { uid?: string; email?: string | null; role?: string } | null;
}

export interface SendCensusEmailInput extends SharedCensusEmailInput {
  selectedYear: number;
  selectedMonth: number;
  selectedDay: number;
  testModeEnabled: boolean;
  testRecipient: string;
  isAdminUser: boolean;
  excelSheetConfig: CensusEmailExcelSheetConfig;
}

export interface SendCensusEmailOutput {
  recipients: string[];
  backupUploaded: boolean;
}

export interface SendCensusEmailWithLinkInput extends SharedCensusEmailInput {
  browserRuntime: CensusEmailBrowserRuntime;
  accessRole?: CensusAccessRole;
}

export interface SendCensusEmailWithLinkOutput {
  recipients: string[];
  shareLink: string;
}

export interface CensusEmailUseCaseDependencies {
  dailyRecordReadPort?: Pick<DailyRecordReadPort, 'initializeDay' | 'getMonthRecords'>;
  censusEmailDeliveryPort?: CensusEmailDeliveryPort;
}

export const executeGenerateCensusShareLink = async (
  browserRuntime: CensusEmailBrowserRuntime
): Promise<ApplicationOutcome<string | null>> => {
  try {
    const origin = browserRuntime.getOrigin();
    if (!origin) {
      return createApplicationFailed(null, [
        { kind: 'validation', message: 'No se pudo resolver el origen de la aplicación.' },
      ]);
    }

    return createApplicationSuccess(buildSharedCensusLink(origin));
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo generar el link de acceso.',
      },
    ]);
  }
};

export const buildSendCensusConfirmationMessage = (
  input: Pick<
    SendCensusEmailInput,
    'currentDateString' | 'recipients' | 'testModeEnabled' | 'testRecipient' | 'isAdminUser'
  >
): string => {
  const recipientsResult = resolveSendingRecipients({
    recipients: input.recipients,
    shouldUseTestMode: input.isAdminUser && input.testModeEnabled,
    testRecipient: input.testRecipient,
  });

  return buildCensusEmailConfirmationText({
    currentDateString: input.currentDateString,
    recipients: recipientsResult.ok ? recipientsResult.recipients : [],
    shouldUseTestMode: input.isAdminUser && input.testModeEnabled,
    formatDate,
  });
};

export const executeSendCensusEmail = async (
  input: SendCensusEmailInput,
  dependencies: CensusEmailUseCaseDependencies = {}
): Promise<ApplicationOutcome<SendCensusEmailOutput | null>> => {
  const dailyRecordReadPort = dependencies.dailyRecordReadPort || defaultDailyRecordReadPort;
  const censusEmailDeliveryPort =
    dependencies.censusEmailDeliveryPort || defaultCensusEmailDeliveryPort;
  if (!input.record) {
    return createApplicationFailed(null, [
      { kind: 'validation', message: 'No hay datos del censo para enviar.' },
    ]);
  }

  const recipientsResult = resolveSendingRecipients({
    recipients: input.recipients,
    shouldUseTestMode: input.isAdminUser && input.testModeEnabled,
    testRecipient: input.testRecipient,
  });
  if (!recipientsResult.ok) {
    return createApplicationFailed(null, [{ kind: 'validation', message: recipientsResult.error }]);
  }

  const issues: Array<{ kind: 'unknown'; message: string }> = [];

  try {
    const integrityDates = buildMonthIntegrityDates({
      year: input.selectedYear,
      monthZeroBased: input.selectedMonth,
      day: input.selectedDay,
    });

    for (let index = 0; index < integrityDates.length; index += 1) {
      const date = integrityDates[index];
      const previousDate = index > 0 ? integrityDates[index - 1] : undefined;
      try {
        await dailyRecordReadPort.initializeDay(date, previousDate);
      } catch (errorOnInitialize) {
        issues.push({
          kind: 'unknown',
          message:
            errorOnInitialize instanceof Error
              ? `No se pudo inicializar ${date}: ${errorOnInitialize.message}`
              : `No se pudo inicializar ${date}.`,
        });
      }
    }

    const finalMessage = resolveFinalCensusEmailMessage({
      message: input.message,
      currentDateString: input.currentDateString,
      nurseSignature: input.nurseSignature,
    });
    const monthRecords = await dailyRecordReadPort.getMonthRecords(
      input.selectedYear,
      input.selectedMonth
    );
    const filteredRecords = resolveMonthRecordsForDelivery({
      monthRecords,
      currentRecord: input.record,
      currentDateString: input.currentDateString,
      selectedYear: input.selectedYear,
      selectedMonth: input.selectedMonth,
      selectedDay: input.selectedDay,
    });
    const workbookPlan = buildCensusWorkbookPlan({
      monthRecords: filteredRecords,
      currentDateString: input.currentDateString,
      config: input.excelSheetConfig,
    });

    await censusEmailDeliveryPort.sendEmail({
      date: input.currentDateString,
      records: workbookPlan.records,
      sheetDescriptors: workbookPlan.sheetDescriptors,
      recipients: recipientsResult.recipients,
      nursesSignature: input.nurseSignature || undefined,
      body: finalMessage,
      userEmail: input.user?.email,
      userRole: input.user?.role || input.role,
    });

    let backupUploaded = true;
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

      await censusEmailDeliveryPort.uploadBackup(excelBlob, input.currentDateString);
    } catch (backupError) {
      backupUploaded = false;
      issues.push({
        kind: 'unknown',
        message:
          backupError instanceof Error
            ? `No se pudo respaldar la copia en la nube: ${backupError.message}`
            : 'No se pudo respaldar la copia en la nube.',
      });
    }

    const output = {
      recipients: recipientsResult.recipients,
      backupUploaded,
    };

    if (issues.length > 0) {
      return createApplicationPartial(output, issues);
    }

    return createApplicationSuccess(output);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo enviar el correo.',
      },
    ]);
  }
};

export const executeSendCensusEmailWithLink = async (
  input: SendCensusEmailWithLinkInput,
  dependencies: CensusEmailUseCaseDependencies = {}
): Promise<ApplicationOutcome<SendCensusEmailWithLinkOutput | null>> => {
  const censusEmailDeliveryPort =
    dependencies.censusEmailDeliveryPort || defaultCensusEmailDeliveryPort;
  if (!input.record) {
    return createApplicationFailed(null, [
      { kind: 'validation', message: 'No hay datos del censo para enviar.' },
    ]);
  }

  const shareLinkResult = await executeGenerateCensusShareLink(input.browserRuntime);
  if (shareLinkResult.status === 'failed' || !shareLinkResult.data) {
    return createApplicationFailed(null, shareLinkResult.issues);
  }

  try {
    const recipientsResult = resolveSendingRecipients({
      recipients: input.recipients,
      shouldUseTestMode: false,
      testRecipient: '',
    });
    const resolvedRecipients = recipientsResult.ok
      ? recipientsResult.recipients
      : CENSUS_DEFAULT_RECIPIENTS;

    await censusEmailDeliveryPort.sendLink({
      date: input.currentDateString,
      records: [input.record],
      recipients: resolvedRecipients,
      nursesSignature: input.nurseSignature || undefined,
      body: input.message,
      shareLink: shareLinkResult.data,
      userEmail: input.user?.email,
      userRole: input.user?.role || input.role,
    });

    return createApplicationSuccess({
      recipients: resolvedRecipients,
      shareLink: shareLinkResult.data,
    });
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'Error al enviar link.',
      },
    ]);
  }
};
