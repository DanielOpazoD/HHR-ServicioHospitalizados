import type {
  DailyRecord,
  DailyRecordPatch,
} from '@/features/census/contracts/censusRecordContracts';
import type { MovementKind } from '@/features/census/controllers/patientMovementCreationErrorPresentation';

export type AtomicPatientMovementListKey = 'discharges' | 'transfers' | 'cma';

interface BuildAtomicPatientMovementPatchInput {
  updatedRecord: DailyRecord;
  movementKey: AtomicPatientMovementListKey;
  sourceBedIds: string[];
}

const movementListKeyByKind: Record<MovementKind, AtomicPatientMovementListKey> = {
  discharge: 'discharges',
  transfer: 'transfers',
};

export const resolveAtomicPatientMovementListKey = (
  kind: MovementKind
): AtomicPatientMovementListKey => movementListKeyByKind[kind];

export const buildAtomicPatientMovementPatch = ({
  updatedRecord,
  movementKey,
  sourceBedIds,
}: BuildAtomicPatientMovementPatchInput): DailyRecordPatch => {
  const patch = {
    [movementKey]: updatedRecord[movementKey] ?? [],
  } as DailyRecordPatch;

  Array.from(new Set(sourceBedIds)).forEach(bedId => {
    const updatedBed = updatedRecord.beds?.[bedId];
    if (!updatedBed) return;

    patch[`beds.${bedId}`] = updatedBed;
  });

  return patch;
};
