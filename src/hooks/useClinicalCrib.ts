/**
 * useClinicalCrib Hook
 * Manages clinical crib (nested patient) operations.
 * Extracted from useBedManagement for better separation of concerns.
 */

import { useCallback } from 'react';
import { DailyRecord, DailyRecordPatch } from '@/types/domain/dailyRecord';
import { PatientData } from '@/types/domain/patient';
import { PatientFieldValue } from '@/types/valueTypes';
import { logger } from '@/services/utils/loggerService';
import {
  buildClinicalCribMultiplePatch,
  buildClinicalCribPatch,
  buildRemoveClinicalCribPatch,
  isClinicalCribFieldUpdateAllowed,
  sanitizeClinicalCribUpdates,
} from '@/hooks/controllers/clinicalCribController';

export interface ClinicalCribActions {
  createCrib: (bedId: string) => void;
  removeCrib: (bedId: string) => void;
  updateCribField: (bedId: string, field: keyof PatientData, value: PatientFieldValue) => void;
  updateCribMultiple: (bedId: string, updates: Partial<PatientData>) => void;
}

const clinicalCribLogger = logger.child('useClinicalCrib');

export const useClinicalCrib = (
  record: DailyRecord | null,
  saveAndUpdate: (updatedRecord: DailyRecord) => void,
  patchRecord: (partial: DailyRecordPatch) => Promise<void>
): ClinicalCribActions => {
  /**
   * Create a new clinical crib for a patient bed
   */
  const createCrib = useCallback(
    (bedId: string) => {
      if (!record) return;

      const parentPatient = record.beds[bedId];

      // Validation: Cannot add crib to empty bed
      if (!parentPatient.patientName) {
        clinicalCribLogger.warn(`Cannot add clinical crib to empty bed ${bedId}`);
        return;
      }

      patchRecord(buildClinicalCribPatch(bedId, parentPatient));
    },
    [record, patchRecord]
  );

  /**
   * Remove clinical crib from a patient bed
   */
  const removeCrib = useCallback(
    (bedId: string) => {
      if (!record) return;

      patchRecord(buildRemoveClinicalCribPatch(bedId));
    },
    [record, patchRecord]
  );

  /**
   * Update a field on the clinical crib
   */
  const updateCribField = useCallback(
    (bedId: string, field: keyof PatientData, value: PatientFieldValue) => {
      if (!record) return;

      if (!isClinicalCribFieldUpdateAllowed(field, value)) {
        clinicalCribLogger.warn('Cannot set admission date to future');
        return;
      }

      const parentPatient = record.beds[bedId];
      if (!parentPatient.clinicalCrib) return;

      patchRecord({
        [`beds.${bedId}.clinicalCrib.${field}`]: value,
      } as DailyRecordPatch);
    },
    [record, patchRecord]
  );

  /**
   * Update multiple clinical crib fields atomically
   */
  const updateCribMultiple = useCallback(
    (bedId: string, updates: Partial<PatientData>) => {
      if (!record) return;

      const parentPatient = record.beds[bedId];
      if (!parentPatient.clinicalCrib) return;

      const sanitizedUpdates = sanitizeClinicalCribUpdates(updates);
      if (updates.admissionDate && !sanitizedUpdates.admissionDate) {
        clinicalCribLogger.warn('Cannot set admission date to future');
      }

      patchRecord(buildClinicalCribMultiplePatch(bedId, sanitizedUpdates));
    },
    [record, patchRecord]
  );

  return {
    createCrib,
    removeCrib,
    updateCribField,
    updateCribMultiple,
  };
};
