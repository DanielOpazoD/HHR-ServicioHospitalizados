import { z } from 'zod';
import { DailyRecord } from '@/types';
import { DATE_REGEX } from './helpers';
import { BedTypeSchema, PatientDataSchema } from './patient';
import { DischargeDataSchema, TransferDataSchema, CMADataSchema } from './movements';

export const DailyRecordSchema: z.ZodType<DailyRecord, z.ZodTypeDef, unknown> = z
  .object({
    date: z.string().regex(DATE_REGEX),
    beds: z.record(z.string(), PatientDataSchema).default({}),
    bedTypeOverrides: z
      .preprocess(
        val => {
          if (!val || typeof val !== 'object') return {};
          const record: Record<string, unknown> = { ...(val as Record<string, unknown>) };
          // Filter out null/undefined values which might come from Firestore deletes or reverts
          Object.keys(record).forEach(key => {
            if (record[key] === null || record[key] === undefined) delete record[key];
          });
          return record;
        },
        z.record(z.string(), BedTypeSchema)
      )
      .default({}),
    discharges: z.array(DischargeDataSchema).default([]),
    transfers: z.array(TransferDataSchema).default([]),
    cma: z.array(CMADataSchema).default([]),
    lastUpdated: z.string().default(() => new Date().toISOString()),
    dateTimestamp: z.number().optional(),
    schemaVersion: z.number().default(1),
    nurses: z.array(z.string()).default(['', '']),
    nurseName: z.string().optional(),
    nursesDayShift: z.array(z.string()).default(['', '']),
    nursesNightShift: z.array(z.string()).default(['', '']),
    tensDayShift: z.array(z.string()).default(['', '', '']),
    tensNightShift: z.array(z.string()).default(['', '', '']),
    activeExtraBeds: z.array(z.string()).default([]),
    handoffDayChecklist: z
      .object({
        escalaBraden: z.boolean().optional(),
        escalaRiesgoCaidas: z.boolean().optional(),
        escalaRiesgoLPP: z.boolean().optional(),
      })
      .default({}),
    handoffNightChecklist: z
      .object({
        estadistica: z.boolean().optional(),
        categorizacionCudyr: z.boolean().optional(),
        encuestaUTI: z.boolean().optional(),
        encuestaMedias: z.boolean().optional(),
        conteoMedicamento: z.boolean().optional(),
        conteoNoControlados: z.boolean().optional(),
        conteoNoControladosProximaFecha: z.string().optional(),
      })
      .default({}),
    handoffNovedadesDayShift: z.string().optional(),
    handoffNovedadesNightShift: z.string().optional(),
    medicalHandoffNovedades: z.string().optional(),
    medicalHandoffDoctor: z.string().optional(),
    medicalHandoffSentAt: z.string().optional(),
    medicalSignature: z
      .object({
        doctorName: z.string(),
        signedAt: z.string(),
        userAgent: z.string().optional(),
      })
      .optional(),
    cudyrLocked: z.boolean().optional(),
    cudyrLockedAt: z.string().optional(),
    cudyrLockedBy: z.string().optional(),
    handoffNightReceives: z.array(z.string()).default([]),
  })
  .passthrough();

/**
 * Full backup schema for import/export
 */
export const FullBackupSchema = z.record(z.string(), DailyRecordSchema);
