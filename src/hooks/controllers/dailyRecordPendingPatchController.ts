import type { DailyRecord, DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
import { applyPatches } from '@/utils/patchUtils';
import {
  PENDING_LOCAL_CENSUS_PATCH_FIELDS,
  isSameEpisodeForExplicitCensusPatch,
} from '@/services/repositories/explicitLocalCensusPatchPolicy';

const pendingPatchRegistry = new Map<string, Map<number, DailyRecordPatch>>();
let pendingPatchSequence = 0;

const getPatchPathValue = (record: DailyRecord, path: string): unknown =>
  path.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    return (value as Record<string, unknown>)[segment];
  }, record);

const findIncomingBedIdForSameEpisode = (
  incomingRecord: DailyRecord,
  previousRecord: DailyRecord,
  previousBedId: string
): string | undefined => {
  const previousPatient = previousRecord.beds[previousBedId];
  if (!previousPatient) {
    return undefined;
  }

  return Object.keys(incomingRecord.beds).find(
    incomingBedId =>
      incomingBedId !== previousBedId &&
      isSameEpisodeForExplicitCensusPatch(incomingRecord.beds[incomingBedId], previousPatient)
  );
};

export const registerPendingDailyRecordPatch = (
  date: string,
  patch: DailyRecordPatch
): (() => void) => {
  const patchId = ++pendingPatchSequence;
  const datePatches = pendingPatchRegistry.get(date) ?? new Map<number, DailyRecordPatch>();
  datePatches.set(patchId, patch);
  pendingPatchRegistry.set(date, datePatches);

  return () => {
    const current = pendingPatchRegistry.get(date);
    if (!current) return;
    current.delete(patchId);
    if (current.size === 0) {
      pendingPatchRegistry.delete(date);
    }
  };
};

export const clearPendingDailyRecordPatchesForTests = (): void => {
  pendingPatchRegistry.clear();
};

const collectPendingExplicitCensusPatch = (
  date: string,
  incomingRecord: DailyRecord,
  previousRecord: DailyRecord | undefined
): DailyRecordPatch => {
  const pendingPatches = pendingPatchRegistry.get(date);
  if (!pendingPatches || !previousRecord) {
    return {};
  }

  const resolvedPatch: Record<string, unknown> = {};
  pendingPatches.forEach(patch => {
    Object.entries(patch as Record<string, unknown>).forEach(([path, value]) => {
      const [root, bedId, field] = path.split('.');
      if (root !== 'beds' || !bedId || !field || !PENDING_LOCAL_CENSUS_PATCH_FIELDS.has(field)) {
        return;
      }

      if (
        isSameEpisodeForExplicitCensusPatch(incomingRecord.beds[bedId], previousRecord.beds[bedId])
      ) {
        resolvedPatch[path] = value;
        return;
      }

      const movedBedId = findIncomingBedIdForSameEpisode(incomingRecord, previousRecord, bedId);
      if (movedBedId) {
        resolvedPatch[`beds.${movedBedId}.${field}`] = value;
      }
    });
  });

  return resolvedPatch as DailyRecordPatch;
};

export const releaseConfirmedPendingDailyRecordPatches = (
  date: string,
  incomingRecord: DailyRecord,
  previousRecord: DailyRecord | undefined
): void => {
  const pendingPatches = pendingPatchRegistry.get(date);
  if (!pendingPatches || !previousRecord) {
    return;
  }

  pendingPatches.forEach((patch, patchId) => {
    const patchRecord = patch as Record<string, unknown>;
    const trackedEntries = Object.entries(patchRecord).filter(([path]) => {
      const [root, bedId, field] = path.split('.');
      return Boolean(
        root === 'beds' && bedId && field && PENDING_LOCAL_CENSUS_PATCH_FIELDS.has(field)
      );
    });

    if (trackedEntries.length === 0) {
      return;
    }

    trackedEntries.forEach(([path, value]) => {
      const [, bedId, field] = path.split('.');
      if (
        bedId &&
        !isSameEpisodeForExplicitCensusPatch(incomingRecord.beds[bedId], previousRecord.beds[bedId])
      ) {
        if (field) {
          const movedBedId = findIncomingBedIdForSameEpisode(incomingRecord, previousRecord, bedId);
          if (movedBedId) {
            const movedPath = `beds.${movedBedId}.${field}`;
            if (getPatchPathValue(incomingRecord, movedPath) === value) {
              delete patchRecord[path];
            }
            return;
          }
        }
        delete patchRecord[path];
      }
    });

    const remainingTrackedEntries = Object.entries(patchRecord).filter(([path]) => {
      const [root, bedId, field] = path.split('.');
      return Boolean(
        root === 'beds' && bedId && field && PENDING_LOCAL_CENSUS_PATCH_FIELDS.has(field)
      );
    });

    const isRemoteConfirmed =
      remainingTrackedEntries.length > 0 &&
      remainingTrackedEntries.every(
        ([path, value]) => getPatchPathValue(incomingRecord, path) === value
      );
    if (remainingTrackedEntries.length === 0 || isRemoteConfirmed) {
      pendingPatches.delete(patchId);
    }
  });

  if (pendingPatches.size === 0) {
    pendingPatchRegistry.delete(date);
  }
};

export const applyPendingExplicitCensusPatch = (
  date: string,
  incomingRecord: DailyRecord,
  previousRecord: DailyRecord | undefined
): DailyRecord => {
  const patch = collectPendingExplicitCensusPatch(date, incomingRecord, previousRecord);
  if (Object.keys(patch).length === 0) {
    return incomingRecord;
  }

  return applyPatches(incomingRecord, patch);
};
