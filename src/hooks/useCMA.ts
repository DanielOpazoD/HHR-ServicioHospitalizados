import { useMemo, useCallback, useRef, useEffect } from 'react';
import type {
  ApplyDailyRecordPatch,
  DailyRecord,
  PersistDailyRecord,
} from '@/application/shared/dailyRecordCoreContracts';
import { CMAData } from '@/types/domain/movements';
import { capitalizeWords } from '@/utils/stringUtils';
import { formatRut, isValidRut, isPassportFormat } from '@/utils/rutUtils';
import { buildClearPatientPatches } from '@/hooks/controllers/bedManagementPatchController';

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

      const newEntry: CMAData = {
        ...data,
        ...normalizedData,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };

      const currentList = currentRecord.cma || [];
      const patch = {
        cma: [...currentList, newEntry],
      };

      if (newEntry.originalBedId && currentRecord.beds?.[newEntry.originalBedId]) {
        Object.assign(patch, buildClearPatientPatches(currentRecord, newEntry.originalBedId));
      }

      patchRecord(patch);
    },
    [patchRecord]
  );

  const deleteCMA = useCallback(
    (id: string) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      const currentList = currentRecord.cma || [];
      patchRecord({
        cma: currentList.filter(item => item.id !== id),
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

  return useMemo(
    () => ({
      addCMA,
      deleteCMA,
      updateCMA,
    }),
    [addCMA, deleteCMA, updateCMA]
  );
};
