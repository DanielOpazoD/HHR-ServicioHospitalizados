import type { DailyRecord, DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
import type { BedAction } from '@/hooks/contracts/bedManagementActionContracts';
import { resolveBedManagementPatch } from '@/hooks/controllers/bedManagementPatchReducerController';

export type { BedAction } from '@/hooks/contracts/bedManagementActionContracts';

/**
 * Calculates the necessary patches to apply an action to the DailyRecord.
 * This is a "Patch Reducer" - instead of returning a new state, it returns the DIFF.
 */
export const bedManagementReducer = (
  state: DailyRecord | null,
  action: BedAction
): DailyRecordPatch | null => {
  if (!state) return null;
  return resolveBedManagementPatch(state, action);
};
