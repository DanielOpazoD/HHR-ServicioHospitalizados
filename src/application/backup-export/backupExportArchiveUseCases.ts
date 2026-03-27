import type { DailyRecord } from '@/application/shared/dailyRecordContracts';
import {
  createApplicationFailed,
  createApplicationPartial,
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/application/shared/applicationOutcome';
import { defaultDailyRecordReadPort } from '@/application/ports/dailyRecordPort';
import { defaultCensusEmailDeliveryPort } from '@/application/ports/censusEmailPort';
import {
  mergeMonthlyRecordsForBackup,
  resolveHandoffBackupStaff,
} from '@/hooks/controllers/exportManagerController';
import { getShiftSchedule } from '@/utils/dateUtils';
import { validateCriticalFields } from '@/services/validation/criticalFieldsValidator';

export interface BackupCensusExcelInput {
  selectedYear: number;
  selectedMonth: number;
  selectedDay: number;
  currentDateString: string;
  record: DailyRecord | null;
}

export interface BackupCensusExcelOutput {
  archivedDate: string;
  recordCount: number;
}

export const executeBackupCensusExcel = async (
  input: BackupCensusExcelInput
): Promise<ApplicationOutcome<BackupCensusExcelOutput | null>> => {
  try {
    const monthRecords = await defaultDailyRecordReadPort.getMonthRecords(
      input.selectedYear,
      input.selectedMonth
    );
    const limitDate = `${input.selectedYear}-${String(input.selectedMonth + 1).padStart(2, '0')}-${String(
      input.selectedDay
    ).padStart(2, '0')}`;

    const filteredRecords = mergeMonthlyRecordsForBackup(
      monthRecords,
      input.record,
      input.currentDateString,
      limitDate
    );

    if (filteredRecords.length === 0) {
      return createApplicationFailed(null, [
        { kind: 'validation', message: 'No hay registros para archivar.' },
      ]);
    }

    const { buildCensusMasterBinary } = await import('@/services/exporters/censusMasterWorkbook');
    const binary = await buildCensusMasterBinary(filteredRecords);
    const blob = new Blob([binary], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await defaultCensusEmailDeliveryPort.uploadBackup(blob, input.currentDateString);

    return createApplicationSuccess({
      archivedDate: input.currentDateString,
      recordCount: filteredRecords.length,
    });
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message:
          error instanceof Error ? error.message : 'Error al realizar el respaldo en la nube',
      },
    ]);
  }
};

export interface ExportHandoffPdfInput {
  record: DailyRecord | null;
  selectedShift: 'day' | 'night';
}

export const executeExportHandoffPdf = async (
  input: ExportHandoffPdfInput
): Promise<ApplicationOutcome<null>> => {
  if (!input.record) {
    return createApplicationFailed(null, [
      { kind: 'validation', message: 'No hay registro para exportar.' },
    ]);
  }

  try {
    const { generateHandoffPdf } = await import('@/services/pdf/handoffPdfGenerator');
    await generateHandoffPdf(input.record, false, input.selectedShift, {
      dayStart: '08:00',
      dayEnd: '20:00',
      nightStart: '20:00',
      nightEnd: '08:00',
    });
    return createApplicationSuccess(null);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'Error al generar el PDF.',
      },
    ]);
  }
};

export interface BackupHandoffPdfInput {
  record: DailyRecord | null;
  selectedShift: 'day' | 'night';
}

export interface BackupHandoffPdfOutput {
  shift: 'day' | 'night';
  createdCudyrBackup: boolean;
}

export const executeBackupHandoffPdf = async (
  input: BackupHandoffPdfInput
): Promise<ApplicationOutcome<BackupHandoffPdfOutput | null>> => {
  if (!input.record) {
    return createApplicationFailed(null, [
      { kind: 'validation', message: 'No hay registro para respaldar.' },
    ]);
  }

  const { delivers, receives } = resolveHandoffBackupStaff(input.record, input.selectedShift);
  if (delivers.length === 0 || receives.length === 0) {
    return createApplicationFailed(null, [
      {
        kind: 'validation',
        message: 'Selecciona enfermera que entrega y recibe antes de guardar',
      },
    ]);
  }

  const validation = validateCriticalFields(input.record);
  if (!validation.isValid) {
    return createApplicationFailed(null, [
      {
        kind: 'validation',
        message: 'Campos críticos incompletos. Complete los datos antes de guardar.',
      },
    ]);
  }

  try {
    const [{ default: jsPDF }, { default: autoTable }, { buildHandoffPdfContent }, { uploadPdf }] =
      await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
        import('@/services/backup/pdfContentBuilder'),
        import('@/services/backup/pdfStorageService'),
      ]);

    const schedule = getShiftSchedule(input.record.date);
    const doc = new jsPDF();
    await buildHandoffPdfContent(doc, input.record, input.selectedShift, schedule, autoTable);
    const pdfBlob = doc.output('blob');
    await uploadPdf(pdfBlob, input.record.date, input.selectedShift);

    if (input.selectedShift !== 'night') {
      return createApplicationSuccess({
        shift: input.selectedShift,
        createdCudyrBackup: false,
      });
    }

    try {
      const { generateCudyrMonthlyExcelBlob } = await import('@/services/cudyr/cudyrExportService');
      const { uploadCudyrExcel } = await import('@/services/backup/cudyrStorageService');
      const [year, month] = input.record.date.split('-').map(Number);
      const cudyrBlob = await generateCudyrMonthlyExcelBlob(
        year,
        month,
        input.record.date,
        input.record
      );
      await uploadCudyrExcel(cudyrBlob, input.record.date);
      return createApplicationSuccess({
        shift: input.selectedShift,
        createdCudyrBackup: true,
      });
    } catch (error) {
      return createApplicationPartial(
        {
          shift: input.selectedShift,
          createdCudyrBackup: false,
        },
        [
          {
            kind: 'unknown',
            message:
              error instanceof Error
                ? `PDF guardado, CUDYR falló: ${error.message}`
                : 'PDF guardado, CUDYR falló',
          },
        ]
      );
    }
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'Error al guardar el respaldo PDF',
      },
    ]);
  }
};
