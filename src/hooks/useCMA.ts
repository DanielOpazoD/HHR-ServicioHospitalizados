import { useMemo, useCallback, useRef, useEffect } from 'react';
import type {
  ApplyDailyRecordPatch,
  DailyRecord,
  DailyRecordPatch,
  PersistDailyRecord,
} from '@/application/shared/dailyRecordCoreContracts';
import { CMAData } from '@/types/domain/movements';
import { capitalizeWords } from '@/utils/stringUtils';
import { formatRut, isValidRut, isPassportFormat } from '@/utils/rutUtils';
import { buildClearPatientPatches } from '@/hooks/controllers/bedManagementPatchController';
import { buildAtomicPatientMovementPatch, buildUndoCmaPatch } from '@/application/census/public';
import { tombstoneMovementById } from '@/application/census/movementTombstonePolicy';
import { buildCmaEpisodeMovementFields } from '@/application/census/cmaEpisodeMovementFields';
import { ensurePatientClinicalEpisodeId } from '@/application/patient-flow/clinicalEpisodeIdPolicy';

/**
 * Normalize CMA patient data fields
 */
const normalizePatientData = (data: Partial<CMAData>): Partial<CMAData> => {
  const normalized = { ...data };

  // Capitalize patient name
  if (normalized.patientName && typeof normalized.patientName === 'string') {
    normalized.patientName = capitalizeWords(normalized.patientName.trim());
  }

  // Format RUT (if not passport)
  if (normalized.rut && typeof normalized.rut === 'string') {
    const trimmedRut = normalized.rut.trim();
    if (!isPassportFormat(trimmedRut)) {
      const formatted = formatRut(trimmedRut);
      if (isValidRut(formatted)) {
        normalized.rut = formatted;
      }
    }
  }

  return normalized;
};

export const useCMA = (
  record: DailyRecord | null,
  _saveAndUpdate: PersistDailyRecord,
  patchRecord: ApplyDailyRecordPatch
) => {
  const recordRef = useRef(record);
  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  const addCMA = useCallback(
    (data: Omit<CMAData, 'id' | 'timestamp'>) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;

      // Normalize data before saving
      const normalizedData = normalizePatientData(data);
      const sourceBedId =
        data.originalBedId && currentRecord.beds?.[data.originalBedId] ? data.originalBedId : null;
      const sourcePatientWithEpisodeId = sourceBedId
        ? ensurePatientClinicalEpisodeId(currentRecord.beds[sourceBedId])
        : null;

      const newEntry: CMAData = {
        ...data,
        ...normalizedData,
        ...buildCmaEpisodeMovementFields(normalizedData, sourcePatientWithEpisodeId),
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };

      const updatedCma = [...(currentRecord.cma || []), newEntry];
      const updatedRecord = {
        ...currentRecord,
        cma: updatedCma,
      };

      if (sourceBedId) {
        const clearPatch = buildClearPatientPatches(currentRecord, sourceBedId);
        updatedRecord.beds = {
          ...currentRecord.beds,
          [sourceBedId]: clearPatch[`beds.${sourceBedId}`] as DailyRecord['beds'][string],
        };
      }

      patchRecord(
        buildAtomicPatientMovementPatch({
          updatedRecord,
          movementKey: 'cma',
          sourceBedIds: sourceBedId ? [sourceBedId] : [],
        })
      );
    },
    [patchRecord]
  );

  const deleteCMA = useCallback(
    (id: string) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      const currentList = currentRecord.cma || [];
      patchRecord({
        cma: tombstoneMovementById(currentList, id),
      });
    },
    [patchRecord]
  );

  const updateCMA = useCallback(
    (id: string, updates: Partial<CMAData>) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;

      // Normalize data before saving
      const normalizedUpdates = normalizePatientData(updates);

      const currentList = currentRecord.cma || [];
      patchRecord({
        cma: currentList.map(item => (item.id === id ? { ...item, ...normalizedUpdates } : item)),
      });
    },
    [patchRecord]
  );

  const undoCMA = useCallback(
    (item: CMAData) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;

      const patch = buildUndoCmaPatch(currentRecord, item);
      if (!patch) return;

      patchRecord(patch as DailyRecordPatch);
    },
    [patchRecord]
  );

  return useMemo(
    () => ({
      addCMA,
      deleteCMA,
      updateCMA,
      undoCMA,
    }),
    [addCMA, deleteCMA, updateCMA, undoCMA]
  );
};
