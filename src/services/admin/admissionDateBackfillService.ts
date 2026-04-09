import type { DailyRecord } from '@/services/contracts/dailyRecordServiceContracts';
import type { DischargeData, TransferData } from '@/types/domain/movements';
import type { PatientData } from '@/types/domain/patient';
import { deepClone } from '@/utils/deepClone';
import { normalizeDateOnly } from '@/utils/clinicalDayUtils';
import {
  getAvailableDates,
  getForDate,
} from '@/services/repositories/dailyRecordRepositoryReadService';
import { saveDetailed as saveDailyRecordDetailed } from '@/services/repositories/dailyRecordRepositoryWriteService';
import { logAuditEvent } from '@/services/admin/auditService';
import { getCurrentUserEmail } from '@/services/admin/utils/auditUtils';
import {
  resolveAdmissionDateAudit,
  resolveAdmissionDateSuggestion,
} from '@/application/patient-flow/admissionDatePolicy';
import { createEpisodeAdmissionTracker } from '@/services/calculations/minsal/episodeTracker';
import { dataMaintenanceLogger } from '@/services/admin/adminLoggers';

/* ================================================================
 * SECTION INDEX
 * 1. Types & Interfaces           (line ~28)
 * 2. Utility Functions            (line ~66)
 * 3. Target Collection            (line ~75)
 * 4. Admission Date Correction    (line ~137)
 * 5. Backfill Plan Builder        (line ~178)
 * 6. Audit (Dry Run)              (line ~239)
 * 7. Apply Backfill               (line ~282)
 * ================================================================ */

// === TYPES & INTERFACES ===

/**
 * Historical correction service for admission dates.
 *
 * It reuses the shared episode registry so the correction is anchored to the
 * first observed day of the episode, while still preserving separate episodes
 * for the same RUT whenever a discharge or transfer closes the prior one.
 */
type AdmissionDateBackfillScope = 'bed' | 'clinicalCrib' | 'discharge' | 'transfer';

export interface AdmissionDateBackfillSample {
  scope: AdmissionDateBackfillScope;
  date: string;
  bedId: string;
  bedName: string;
  patientName: string;
  rut: string;
  previousAdmissionDate?: string;
  suggestedAdmissionDate: string;
  firstSeenDate: string;
}

export interface AdmissionDateBackfillResult {
  scannedDays: number;
  reviewedEntries: number;
  correctionCount: number;
  touchedRecords: number;
  appliedRecords: number;
  failedRecords: number;
  outcome: 'clean' | 'repaired' | 'partial' | 'blocked';
  samples: AdmissionDateBackfillSample[];
  userSafeMessage: string;
}

interface BackfillTarget {
  scope: AdmissionDateBackfillScope;
  patient: PatientData;
  date: string;
  bedId: string;
  bedName: string;
}

interface RecordPlan {
  record: DailyRecord;
  corrections: AdmissionDateBackfillSample[];
}

// === UTILITY FUNCTIONS ===

const normalizeRutKey = (rut: string): string =>
  rut
    .replace(/[.\-\s]/g, '')
    .trim()
    .toUpperCase();

const hasPatientIdentity = (patient: PatientData | undefined): patient is PatientData =>
  Boolean(patient?.patientName?.trim() && patient?.rut?.trim());

// === TARGET COLLECTION ===

const collectTargetsFromDischarge = (date: string, discharge: DischargeData): BackfillTarget[] => {
  if (!discharge.originalData) return [];
  return [
    {
      scope: 'discharge',
      patient: discharge.originalData,
      date,
      bedId: discharge.bedId,
      bedName: discharge.bedName,
    },
  ];
};

const collectTargetsFromTransfer = (date: string, transfer: TransferData): BackfillTarget[] => {
  if (!transfer.originalData) return [];
  return [
    {
      scope: 'transfer',
      patient: transfer.originalData,
      date,
      bedId: transfer.bedId,
      bedName: transfer.bedName,
    },
  ];
};

const collectTargetsFromRecord = (record: DailyRecord): BackfillTarget[] => {
  const targets: BackfillTarget[] = [];

  Object.entries(record.beds).forEach(([bedId, patient]) => {
    if (hasPatientIdentity(patient)) {
      targets.push({
        scope: 'bed',
        patient,
        date: record.date,
        bedId,
        bedName: patient.bedName || bedId,
      });
    }

    if (hasPatientIdentity(patient.clinicalCrib)) {
      targets.push({
        scope: 'clinicalCrib',
        patient: patient.clinicalCrib,
        date: record.date,
        bedId,
        bedName: patient.bedName ? `Cuna (${patient.bedName})` : `Cuna (${bedId})`,
      });
    }
  });

  record.discharges?.forEach(discharge => {
    targets.push(...collectTargetsFromDischarge(record.date, discharge));
  });

  record.transfers?.forEach(transfer => {
    targets.push(...collectTargetsFromTransfer(record.date, transfer));
  });

  return targets;
};

// === ADMISSION DATE CORRECTION ===

const applyAdmissionDateCorrection = (
  target: BackfillTarget,
  firstSeenDate: string
): AdmissionDateBackfillSample | null => {
  const audit = resolveAdmissionDateAudit({
    recordDate: target.date,
    admissionDate: target.patient.admissionDate,
    admissionTime: target.patient.admissionTime,
    firstSeenDate,
  });

  const suggestedAdmissionDate =
    audit.suggestedAdmissionDate ||
    resolveAdmissionDateSuggestion(firstSeenDate, target.patient.admissionTime) ||
    firstSeenDate;
  const normalizedCurrentAdmission = normalizeDateOnly(target.patient.admissionDate);
  const normalizedFirstSeen = normalizeDateOnly(target.patient.firstSeenDate);

  const needsAdmissionUpdate = normalizedCurrentAdmission !== suggestedAdmissionDate;
  const needsFirstSeenUpdate = normalizedFirstSeen !== firstSeenDate;

  if (!needsAdmissionUpdate && !needsFirstSeenUpdate) {
    return null;
  }

  target.patient.firstSeenDate = firstSeenDate;
  target.patient.admissionDate = suggestedAdmissionDate;

  return {
    scope: target.scope,
    date: target.date,
    bedId: target.bedId,
    bedName: target.bedName,
    patientName: target.patient.patientName,
    rut: target.patient.rut,
    previousAdmissionDate: normalizedCurrentAdmission,
    suggestedAdmissionDate,
    firstSeenDate,
  };
};

// === BACKFILL PLAN BUILDER ===

const buildBackfillPlan = async (): Promise<{
  records: RecordPlan[];
  scannedDays: number;
  reviewedEntries: number;
}> => {
  const dates = (await getAvailableDates()).slice().sort();
  const records: RecordPlan[] = [];
  const episodeTracker = createEpisodeAdmissionTracker();
  let reviewedEntries = 0;

  for (const date of dates) {
    const record = await getForDate(date);
    if (!record) {
      continue;
    }

    const clonedRecord = deepClone(record);
    const corrections: AdmissionDateBackfillSample[] = [];
    const targets = collectTargetsFromRecord(clonedRecord);

    Object.values(clonedRecord.beds || {}).forEach(bed => {
      episodeTracker.observeBed(bed, date);
    });

    for (const target of targets) {
      const rutKey = normalizeRutKey(target.patient.rut);
      if (!rutKey) continue;

      reviewedEntries += 1;

      const firstSeenDate =
        episodeTracker.resolveEpisodeStartDate(target.patient.rut, target.date) || target.date;
      const correction = applyAdmissionDateCorrection(target, firstSeenDate);
      if (correction) {
        corrections.push(correction);
      }
    }

    record.discharges?.forEach(discharge => {
      episodeTracker.closeEpisode(discharge.rut);
    });

    record.transfers?.forEach(transfer => {
      episodeTracker.closeEpisode(transfer.rut);
    });

    if (corrections.length > 0) {
      records.push({
        record: clonedRecord,
        corrections,
      });
    }
  }

  return {
    records,
    scannedDays: dates.length,
    reviewedEntries,
  };
};

// === AUDIT (DRY RUN) ===

export const auditAdmissionDateBackfill = async (): Promise<AdmissionDateBackfillResult> => {
  try {
    const plan = await buildBackfillPlan();
    const correctionCount = plan.records.reduce(
      (total, item) => total + item.corrections.length,
      0
    );
    const samples = plan.records.flatMap(item => item.corrections).slice(0, 10);
    const outcome = correctionCount > 0 ? 'repaired' : 'clean';

    return {
      scannedDays: plan.scannedDays,
      reviewedEntries: plan.reviewedEntries,
      correctionCount,
      touchedRecords: plan.records.length,
      appliedRecords: 0,
      failedRecords: 0,
      outcome,
      samples,
      userSafeMessage:
        correctionCount > 0
          ? 'Se detectaron fechas de ingreso inconsistentes. Puede aplicar la corrección masiva.'
          : 'No se detectaron fechas de ingreso inconsistentes.',
    };
  } catch (error) {
    dataMaintenanceLogger.error('Admission date backfill audit failed', error);
    return {
      scannedDays: 0,
      reviewedEntries: 0,
      correctionCount: 0,
      touchedRecords: 0,
      appliedRecords: 0,
      failedRecords: 0,
      outcome: 'blocked',
      samples: [],
      userSafeMessage:
        error instanceof Error
          ? error.message
          : 'No se pudo auditar las fechas de ingreso históricas.',
    };
  }
};

// === APPLY BACKFILL ===

export const applyAdmissionDateBackfill = async (
  onProgress?: (current: number, total: number) => void
): Promise<AdmissionDateBackfillResult> => {
  try {
    const plan = await buildBackfillPlan();
    let appliedRecords = 0;
    let failedRecords = 0;

    for (let index = 0; index < plan.records.length; index += 1) {
      const item = plan.records[index];
      try {
        await saveDailyRecordDetailed(item.record);
        appliedRecords += 1;
      } catch (error) {
        failedRecords += 1;
        dataMaintenanceLogger.error(
          `Failed to backfill admission dates for ${item.record.date}`,
          error
        );
      }

      if (onProgress) {
        onProgress(index + 1, plan.records.length);
      }
    }

    const correctionCount = plan.records.reduce(
      (total, item) => total + item.corrections.length,
      0
    );
    const outcome =
      correctionCount === 0
        ? 'clean'
        : appliedRecords === 0
          ? 'blocked'
          : failedRecords > 0
            ? 'partial'
            : 'repaired';
    const samples = plan.records.flatMap(item => item.corrections).slice(0, 10);

    if (appliedRecords > 0) {
      await logAuditEvent(
        getCurrentUserEmail(),
        'DATA_ADMISSION_DATES_BACKFILLED',
        'dailyRecord',
        'historical-admission-dates',
        {
          scannedDays: plan.scannedDays,
          reviewedEntries: plan.reviewedEntries,
          correctionCount,
          touchedRecords: plan.records.length,
          appliedRecords,
          failedRecords,
          outcome,
          samples,
        }
      );
    }

    return {
      scannedDays: plan.scannedDays,
      reviewedEntries: plan.reviewedEntries,
      correctionCount,
      touchedRecords: plan.records.length,
      appliedRecords,
      failedRecords,
      outcome,
      samples,
      userSafeMessage:
        correctionCount > 0
          ? failedRecords > 0
            ? 'Se aplicó la corrección histórica con algunos fallos.'
            : 'Se aplicó la corrección histórica de fechas de ingreso.'
          : 'No había fechas de ingreso para corregir.',
    };
  } catch (error) {
    dataMaintenanceLogger.error('Admission date backfill failed', error);
    return {
      scannedDays: 0,
      reviewedEntries: 0,
      correctionCount: 0,
      touchedRecords: 0,
      appliedRecords: 0,
      failedRecords: 0,
      outcome: 'blocked',
      samples: [],
      userSafeMessage:
        error instanceof Error
          ? error.message
          : 'No se pudo aplicar la corrección histórica de fechas de ingreso.',
    };
  }
};
