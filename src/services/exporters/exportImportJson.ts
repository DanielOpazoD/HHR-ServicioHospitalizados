import { DailyRecord } from '@/types/domain/dailyRecord';
import { saveRecord } from '@/services/storage/records';
import { hasStructuralRepairs, parseDailyRecordWithDefaultsReport } from '@/schemas/zodSchemas';
import { jsonImportLogger } from '@/services/exporters/exporterLoggers';

export interface JsonImportResult {
  success: boolean;
  outcome: 'clean' | 'repaired' | 'partial' | 'blocked';
  importedCount: number;
  repairedCount: number;
  skippedEntries: string[];
}

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve((event.target?.result as string) || '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsText(file);
  });

const persistImportedRecords = async (records: DailyRecord[]): Promise<void> => {
  await Promise.all(records.map(record => saveRecord(record)));
};

const parseImportPayload = (text: string): Record<string, unknown> => {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('El archivo JSON debe contener un objeto de registros por fecha.');
  }
  return parsed as Record<string, unknown>;
};

export const importDataJSONDetailed = async (file: File): Promise<JsonImportResult> => {
  try {
    const text = await readFileAsText(file);
    const payload = parseImportPayload(text);

    const importedRecords: DailyRecord[] = [];
    const skippedEntries: string[] = [];
    let repairedCount = 0;

    Object.entries(payload).forEach(([key, value]) => {
      try {
        const parsed = parseDailyRecordWithDefaultsReport(value, key);
        importedRecords.push(parsed.record);

        if (hasStructuralRepairs(parsed.report)) {
          repairedCount += 1;
        }
      } catch (_error) {
        skippedEntries.push(key);
      }
    });

    if (importedRecords.length === 0) {
      alert('El archivo JSON no contiene registros importables.');
      return {
        success: false,
        outcome: 'blocked',
        importedCount: 0,
        repairedCount: 0,
        skippedEntries,
      };
    }

    await persistImportedRecords(importedRecords);
    const outcome =
      skippedEntries.length > 0 ? 'partial' : repairedCount > 0 ? 'repaired' : 'clean';
    return {
      success: true,
      outcome,
      importedCount: importedRecords.length,
      repairedCount,
      skippedEntries,
    };
  } catch (error) {
    jsonImportLogger.error('JSON import failed', error);
    alert('Error al procesar el archivo JSON.');
    return {
      success: false,
      outcome: 'blocked',
      importedCount: 0,
      repairedCount: 0,
      skippedEntries: [],
    };
  }
};

export const importDataJSON = async (file: File): Promise<boolean> => {
  const result = await importDataJSONDetailed(file);
  return result.success;
};
