/**
 * useClinicalCrib Hook
 * Manages clinical crib (nested patient) operations.
 * Extracted from useBedManagement for better separation of concerns.
 */

import { useCallback } from 'react';
import { DailyRecord, DailyRecordPatch } from '@/types/domain/dailyRecord';
import { PatientData } from '@/types/domain/patient';
import { PatientFieldValue } from '@/types/valueTypes';
import { createEmptyPatient } from '@/services/factories/patientFactory';
import { logger } from '@/services/utils/loggerService';

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
  const resolveMotherLabel = (patient: PatientData): string => {
    const fullNameFromParts = [patient.firstName, patient.lastName, patient.secondLastName]
      .map(part => (part || '').trim())
      .filter(Boolean)
      .join(' ');
    const fallbackName = (patient.patientName || '').trim();
    return fullNameFromParts || fallbackName || 'Madre';
  };

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

      const newCrib = createEmptyPatient(bedId);
      newCrib.bedMode = 'Cuna';
      newCrib.identityStatus = 'provisional';
      newCrib.patientName = `RN de ${resolveMotherLabel(parentPatient)}`;
      newCrib.firstName = '';
      newCrib.lastName = '';
      newCrib.secondLastName = '';
      newCrib.rut = '';
      newCrib.documentType = 'RUT';

      patchRecord({
        [`beds.${bedId}.clinicalCrib`]: newCrib,
        [`beds.${bedId}.hasCompanionCrib`]: false,
      } as DailyRecordPatch);
    },
    [record, patchRecord]
  );

  /**
   * Remove clinical crib from a patient bed
   */
  const removeCrib = useCallback(
    (bedId: string) => {
      if (!record) return;

      patchRecord({
        [`beds.${bedId}.clinicalCrib`]: null,
      } as DailyRecordPatch);
    },
    [record, patchRecord]
  );

  /**
   * Update a field on the clinical crib
   */
  const updateCribField = useCallback(
    (bedId: string, field: keyof PatientData, value: PatientFieldValue) => {
      if (!record) return;

      // Validation: Admission date cannot be in the future
      if (field === 'admissionDate' && typeof value === 'string') {
        const selectedDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate > today) {
          clinicalCribLogger.warn('Cannot set admission date to future');
          return;
        }
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

      if (updates.admissionDate) {
        const selectedDate = new Date(updates.admissionDate as string);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate > today) {
          clinicalCribLogger.warn('Cannot set admission date to future');
          delete updates.admissionDate;
        }
      }

      const patches: DailyRecordPatch = {};
      Object.entries(updates).forEach(([key, value]) => {
        (patches as Record<string, unknown>)[`beds.${bedId}.clinicalCrib.${key}`] = value;
      });

      patchRecord(patches);
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
