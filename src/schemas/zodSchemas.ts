/**
 * Zod Schemas for Data Validation - Facade
 *
 * This file re-exports all schemas from domain-specific files
 * for easy consumption throughout the app.
 */

import { z } from 'zod';
import {
  PatientData,
  DischargeData,
  TransferData,
  CMAData,
  DailyRecord,
  CudyrScore,
  BedType,
} from '@/types';

// Re-exports from domain files
export * from './zod/helpers';
export * from './zod/patient';
export * from './zod/movements';
export * from './zod/dailyRecord';

// Import schemas for validation helpers
import { RUT_REGEX, DATE_REGEX } from './zod/helpers';
import { PatientDataSchema, CudyrScoreSchema } from './zod/patient';
import { DailyRecordSchema, FullBackupSchema } from './zod/dailyRecord';
import { DischargeDataSchema, TransferDataSchema, CMADataSchema } from './zod/movements';

// ============================================================================
// Validation Helpers & Types
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export const validatePatientData = (data: unknown): ValidationResult<PatientData> => {
  const result = PatientDataSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : {
        success: false,
        errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
};

export const validateDailyRecord = (data: unknown): ValidationResult<DailyRecord> => {
  const result = DailyRecordSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data as DailyRecord }
    : {
        success: false,
        errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
};

export const validateBackupData = (
  data: unknown
): ValidationResult<Record<string, DailyRecord>> => {
  const result = FullBackupSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data as Record<string, DailyRecord> }
    : {
        success: false,
        errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
};

export const validateRut = (rut: string): boolean => {
  if (!rut || rut.trim() === '') return true;
  return RUT_REGEX.test(rut);
};

export const validateAdmissionDate = (dateStr: string): ValidationResult<string> => {
  if (!dateStr || dateStr.trim() === '') return { success: true, data: '' };
  if (!DATE_REGEX.test(dateStr))
    return { success: false, errors: ['Formato de fecha inválido (YYYY-MM-DD)'] };
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date > today
    ? { success: false, errors: ['La fecha de ingreso no puede ser futura'] }
    : { success: true, data: dateStr };
};

export const validateCudyrScore = (score: unknown): ValidationResult<CudyrScore> => {
  const result = CudyrScoreSchema.safeParse(score);
  return result.success
    ? { success: true, data: result.data }
    : {
        success: false,
        errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
};

export type PatientDataValidated = z.infer<typeof PatientDataSchema>;
export type DailyRecordValidated = z.infer<typeof DailyRecordSchema>;
export type CudyrScoreValidated = z.infer<typeof CudyrScoreSchema>;
export type DischargeDataValidated = z.infer<typeof DischargeDataSchema>;
export type TransferDataValidated = z.infer<typeof TransferDataSchema>;

// ============================================================================
// Safe Parsing Utilities
// ============================================================================

export const safeParseDailyRecord = (data: unknown): DailyRecord | null => {
  const result = DailyRecordSchema.safeParse(data);
  if (result.success) return result.data as DailyRecord;
  console.warn('⚠️ DailyRecord validation failed:', result.error.issues);
  return null;
};

export const parseDailyRecordWithDefaults = (data: unknown, docId: string): DailyRecord => {
  try {
    const result = DailyRecordSchema.safeParse(data);
    if (result.success) return result.data as DailyRecord;
  } catch (_err) {
    // console.debug('⚠️ Unexpected error parsing DailyRecord for date:', docId, _err);
  }

  const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const salvagedBeds: Record<string, PatientData> = {};
  if (raw.beds && typeof raw.beds === 'object' && !Array.isArray(raw.beds)) {
    Object.entries(raw.beds as Record<string, unknown>).forEach(([id, patient]) => {
      const parsed = PatientDataSchema.safeParse(patient);
      salvagedBeds[id] = parsed.success ? parsed.data : (patient as PatientData) || { bedId: id };
    });
  }

  const salvagedDischarges: DischargeData[] = [];
  if (Array.isArray(raw.discharges)) {
    raw.discharges.forEach(item => {
      const parsed = DischargeDataSchema.safeParse(item);
      if (parsed.success) salvagedDischarges.push(parsed.data);
      else console.warn('⚠️ Discharge item salvage failed:', parsed.error.issues);
    });
  }

  const salvagedTransfers: TransferData[] = [];
  if (Array.isArray(raw.transfers)) {
    raw.transfers.forEach(item => {
      const parsed = TransferDataSchema.safeParse(item);
      if (parsed.success) salvagedTransfers.push(parsed.data);
      else console.warn('⚠️ Transfer item salvage failed:', parsed.error.issues);
    });
  }

  const salvagedCMA: CMAData[] = [];
  if (Array.isArray(raw.cma)) {
    raw.cma.forEach(item => {
      const parsed = CMADataSchema.safeParse(item);
      if (parsed.success) salvagedCMA.push(parsed.data);
      else console.warn('⚠️ CMA item salvage failed:', parsed.error.issues);
    });
  }

  return {
    date: typeof raw.date === 'string' ? raw.date : docId,
    beds: salvagedBeds,
    discharges: salvagedDischarges,
    transfers: salvagedTransfers,
    cma: salvagedCMA,
    lastUpdated: typeof raw.lastUpdated === 'string' ? raw.lastUpdated : new Date().toISOString(),
    nurses: Array.isArray(raw.nurses) ? raw.nurses : ['', ''],
    nursesDayShift: Array.isArray(raw.nursesDayShift) ? raw.nursesDayShift : ['', ''],
    nursesNightShift: Array.isArray(raw.nursesNightShift) ? raw.nursesNightShift : ['', ''],
    tensDayShift: Array.isArray(raw.tensDayShift) ? raw.tensDayShift : ['', '', ''],
    tensNightShift: Array.isArray(raw.tensNightShift) ? raw.tensNightShift : ['', '', ''],
    activeExtraBeds: Array.isArray(raw.activeExtraBeds) ? raw.activeExtraBeds : [],
    handoffDayChecklist: (raw.handoffDayChecklist as DailyRecord['handoffDayChecklist']) || {},
    handoffNightChecklist:
      (raw.handoffNightChecklist as DailyRecord['handoffNightChecklist']) || {},
    handoffNovedadesDayShift:
      typeof raw.handoffNovedadesDayShift === 'string' ? raw.handoffNovedadesDayShift : '',
    handoffNovedadesNightShift:
      typeof raw.handoffNovedadesNightShift === 'string' ? raw.handoffNovedadesNightShift : '',
    medicalHandoffNovedades:
      typeof raw.medicalHandoffNovedades === 'string' ? raw.medicalHandoffNovedades : '',
    handoffNightReceives: Array.isArray(raw.handoffNightReceives) ? raw.handoffNightReceives : [],
    bedTypeOverrides: (raw.bedTypeOverrides as Record<string, BedType>) || {},
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
  } as DailyRecord;
};
