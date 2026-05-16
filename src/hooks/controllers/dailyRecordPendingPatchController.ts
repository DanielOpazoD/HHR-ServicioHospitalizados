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
        !isSameEpisodeForExplicitCensusPatch(incomingRecord.beds[bedId], previousRecord.beds[bedId])
      ) {
        return;
      }

      resolvedPatch[path] = value;
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
    const explicitEntries = Object.entries(patch as Record<string, unknown>).filter(([path]) => {
      const [root, bedId, field] = path.split('.');
      return Boolean(
        root === 'beds' &&
        bedId &&
        field &&
        PENDING_LOCAL_CENSUS_PATCH_FIELDS.has(field) &&
        isSameEpisodeForExplicitCensusPatch(incomingRecord.beds[bedId], previousRecord.beds[bedId])
      );
    });

    if (explicitEntries.length === 0) {
      return;
    }

    const isRemoteConfirmed = explicitEntries.every(
      ([path, value]) => getPatchPathValue(incomingRecord, path) === value
    );
    if (isRemoteConfirmed) {
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
