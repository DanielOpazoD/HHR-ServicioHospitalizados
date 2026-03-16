import { DailyRecord } from '@/types/domain/dailyRecord';
import { localPersistence } from '@/services/storage/localpersistence/localPersistenceService';
import { buildMonthRecordPrefix } from '@/services/storage/storageDateSupport';
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryService';

import { ensureDbReady, hospitalDB as db, isDatabaseInFallbackMode } from './indexedDbCore';

const toRecordMap = (records: DailyRecord[]): Record<string, DailyRecord> => {
  const result: Record<string, DailyRecord> = {};
  for (const record of records) {
    result[record.date] = record;
  }
  return result;
};

const sortRecordsDescending = (records: DailyRecord[]): DailyRecord[] =>
  [...records].sort((a, b) => b.date.localeCompare(a.date));

export const getAllRecords = async (): Promise<Record<string, DailyRecord>> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return localPersistence.records.getAll();
    }
    const records = await db.dailyRecords.toArray();
    return toRecordMap(records);
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_get_all_records', error, {
      code: 'indexeddb_get_all_records_failed',
      message: 'No fue posible obtener todos los registros locales.',
      severity: 'warning',
      userSafeMessage: 'No fue posible recuperar todos los registros locales.',
    });
    return {};
  }
};

export const getRecordsForMonth = async (year: number, month: number): Promise<DailyRecord[]> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return sortRecordsDescending(await localPersistence.records.getRecordsForMonth(year, month));
    }
    return sortRecordsDescending(
      await db.dailyRecords.where('date').startsWith(buildMonthRecordPrefix(year, month)).toArray()
    );
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_get_records_for_month', error, {
      code: 'indexeddb_get_records_for_month_failed',
      message: `No fue posible obtener registros del mes ${year}-${month}.`,
      severity: 'warning',
      userSafeMessage: 'No fue posible recuperar registros del mes solicitado.',
      context: { year, month },
    });
    return [];
  }
};

export const getRecordsRange = async (
  startDate: string,
  endDate: string
): Promise<DailyRecord[]> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return localPersistence.records.getRecordsRange(startDate, endDate);
    }

    return await db.dailyRecords.where('date').between(startDate, endDate, true, true).toArray();
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_get_records_range', error, {
      code: 'indexeddb_get_records_range_failed',
      message: 'No fue posible obtener registros en el rango solicitado.',
      severity: 'warning',
      userSafeMessage: 'No fue posible recuperar registros del rango solicitado.',
      context: { startDate, endDate },
    });
    return [];
  }
};

export const getRecordForDate = async (date: string): Promise<DailyRecord | null> => {
  try {
    await ensureDbReady();

    if (
      isDatabaseInFallbackMode() &&
      typeof window !== 'undefined' &&
      window.__HHR_E2E_OVERRIDE__
    ) {
      const override = window.__HHR_E2E_OVERRIDE__;
      if (override[date]) return override[date];
    }

    if (isDatabaseInFallbackMode()) {
      return localPersistence.records.getForDate(date);
    }

    const record = await db.dailyRecords.get(date);
    return record || null;
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_get_record_for_date', error, {
      code: 'indexeddb_get_record_for_date_failed',
      message: `No fue posible obtener el registro del dia ${date}.`,
      severity: 'warning',
      userSafeMessage: 'No fue posible recuperar el registro solicitado.',
      context: { date },
    });
    return null;
  }
};

export const saveRecord = async (record: DailyRecord): Promise<void> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      localPersistence.records.save(record);
      return;
    }
    await db.dailyRecords.put(record);
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_save_record', error, {
      code: 'indexeddb_save_record_failed',
      message: 'No fue posible guardar el registro local.',
      severity: 'error',
      userSafeMessage: 'No fue posible guardar el registro local.',
      context: { date: record.date },
    });
  }
};

export const saveRecords = async (records: DailyRecord[]): Promise<void> => {
  try {
    await ensureDbReady();
    if (records.length === 0) {
      return;
    }

    if (isDatabaseInFallbackMode()) {
      records.forEach(record => {
        localPersistence.records.save(record);
      });
      return;
    }

    await db.dailyRecords.bulkPut(records);
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_save_records', error, {
      code: 'indexeddb_save_records_failed',
      message: 'No fue posible guardar registros locales en bloque.',
      severity: 'error',
      userSafeMessage: 'No fue posible guardar registros locales.',
      context: { count: records.length },
    });
  }
};

export const deleteRecord = async (date: string): Promise<void> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      localPersistence.records.deleteForDate(date);
      return;
    }
    await db.dailyRecords.delete(date);
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_delete_record', error, {
      code: 'indexeddb_delete_record_failed',
      message: 'No fue posible eliminar el registro local.',
      severity: 'warning',
      userSafeMessage: 'No fue posible eliminar el registro local.',
      context: { date },
    });
  }
};

export const getAllDates = async (): Promise<string[]> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return localPersistence.records.getAllDates();
    }
    const records = await db.dailyRecords.orderBy('date').reverse().keys();
    return records as string[];
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_get_all_dates', error, {
      code: 'indexeddb_get_all_dates_failed',
      message: 'No fue posible obtener las fechas locales disponibles.',
      severity: 'warning',
      userSafeMessage: 'No fue posible recuperar las fechas locales disponibles.',
    });
    return [];
  }
};

export const getAllRecordsSorted = async (): Promise<DailyRecord[]> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return sortRecordsDescending(Object.values(await localPersistence.records.getAll()));
    }

    return await db.dailyRecords.orderBy('date').reverse().toArray();
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_get_sorted_records', error, {
      code: 'indexeddb_get_sorted_records_failed',
      message: 'No fue posible obtener registros locales ordenados.',
      severity: 'warning',
      userSafeMessage: 'No fue posible recuperar registros locales ordenados.',
    });
    return [];
  }
};

export const getPreviousDayRecord = async (currentDate: string): Promise<DailyRecord | null> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return localPersistence.records.getPreviousDayRecord(currentDate);
    }
    const record = await db.dailyRecords.where('date').below(currentDate).reverse().first();
    return record || null;
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_get_previous_day_record', error, {
      code: 'indexeddb_get_previous_day_record_failed',
      message: 'No fue posible obtener el registro del dia previo.',
      severity: 'warning',
      userSafeMessage: 'No fue posible recuperar el registro del dia previo.',
      context: { currentDate },
    });
    return null;
  }
};

export const clearAllRecords = async (): Promise<void> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      localPersistence.records.clear();
      return;
    }
    await db.dailyRecords.clear();
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_clear_all_records', error, {
      code: 'indexeddb_clear_all_records_failed',
      message: 'No fue posible limpiar los registros locales.',
      severity: 'warning',
      userSafeMessage: 'No fue posible limpiar los registros locales.',
    });
  }
};
