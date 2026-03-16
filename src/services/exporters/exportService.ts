import { DailyRecord } from '@/types/core';
import { getAllRecords } from '@/services/storage/records';
import { downloadBlob } from '@/services/exporters/exportDownload';
import { buildDailyRecordCsv } from '@/services/exporters/exportCsvSerialization';
import {
  importDataJSON as importDataJSONFile,
  importDataJSONDetailed as importDataJSONDetailedFile,
  JsonImportResult,
} from '@/services/exporters/exportImportJson';
import { logger } from '@/services/utils/loggerService';

const exportServiceLogger = logger.child('ExportService');

export const exportDataJSON = async () => {
  const data = await getAllRecords();
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadBlob(blob, `hanga_roa_respaldo_${new Date().toISOString().split('T')[0]}.json`);
};

export const exportDataCSV = (record: DailyRecord | null) => {
  if (!record) return;
  const csvString = buildDailyRecordCsv(record);
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `Censo_HangaRoa_${record.date}.csv`);
};

export const importDataJSON = async (file: File): Promise<boolean> => {
  return importDataJSONFile(file);
};

export const importDataJSONDetailed = async (file: File): Promise<JsonImportResult> => {
  return importDataJSONDetailedFile(file);
};

export const importDataCSV = async (_file: File): Promise<boolean> => {
  exportServiceLogger.warn('CSV import is not fully implemented. Use JSON.');
  return Promise.resolve(false);
};
