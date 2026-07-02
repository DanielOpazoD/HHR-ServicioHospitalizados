import type { DailyRecord } from '@/types/domain/dailyRecord';
import {
  applyDailyRecordClinicalConsistencyCheck,
  type DailyRecordClinicalConsistencyContext,
} from '@/services/repositories/dailyRecordClinicalConsistencyCheck';

const MOVEMENT_FIELDS = ['discharges', 'transfers', 'cma'] as const;

type MovementField = (typeof MOVEMENT_FIELDS)[number];

export type DailyRecordConflictPostMergeInvariantViolationType =
  | 'movement_missing_after_merge'
  | 'movement_tombstone_revived'
  | 'duplicate_active_patient_after_merge';

export interface DailyRecordConflictPostMergeInvariantViolation {
  type: DailyRecordConflictPostMergeInvariantViolationType;
  path: string;
  message: string;
}

export interface DailyRecordConflictPostMergeInvariantResult {
  record: DailyRecord;
  status: 'ok' | 'blocked';
  violations: DailyRecordConflictPostMergeInvariantViolation[];
}

interface EvaluateDailyRecordConflictPostMergeInvariantsInput {
  remote: DailyRecord;
  local: DailyRecord;
  resolved: DailyRecord;
  context: DailyRecordClinicalConsistencyContext;
}

type MovementLike = {
  id?: string | number;
  deletedAt?: unknown;
  patientName?: unknown;
};

const normalizeId = (value: unknown): string => String(value || '').trim();

const isDeletedMovement = (movement: MovementLike | undefined): boolean =>
  Boolean(String(movement?.deletedAt || '').trim());

const getMovementItems = (record: DailyRecord, field: MovementField): MovementLike[] =>
  Array.isArray(record[field]) ? (record[field] as unknown as MovementLike[]) : [];

const collectById = (record: DailyRecord, field: MovementField): Map<string, MovementLike> => {
  const items = new Map<string, MovementLike>();
  getMovementItems(record, field).forEach(item => {
    const id = normalizeId(item.id);
    if (id) {
      items.set(id, item);
    }
  });
  return items;
};

const describeMovement = (movement: MovementLike | undefined, id: string): string => {
  const patientName = String(movement?.patientName || '').trim();
  return patientName ? `${patientName} (${id})` : id;
};

const collectMovementInvariantViolations = ({
  remote,
  local,
  resolved,
}: Pick<
  EvaluateDailyRecordConflictPostMergeInvariantsInput,
  'remote' | 'local' | 'resolved'
>): DailyRecordConflictPostMergeInvariantViolation[] => {
  const violations: DailyRecordConflictPostMergeInvariantViolation[] = [];

  MOVEMENT_FIELDS.forEach(field => {
    const remoteById = collectById(remote, field);
    const localById = collectById(local, field);
    const resolvedById = collectById(resolved, field);
    const ids = new Set([...remoteById.keys(), ...localById.keys()]);

    ids.forEach(id => {
      const remoteMovement = remoteById.get(id);
      const localMovement = localById.get(id);
      const resolvedMovement = resolvedById.get(id);
      const sourceHasTombstone =
        isDeletedMovement(remoteMovement) || isDeletedMovement(localMovement);

      if (sourceHasTombstone) {
        if (!isDeletedMovement(resolvedMovement)) {
          violations.push({
            type: 'movement_tombstone_revived',
            path: `${field}.${id}`,
            message: `El movimiento eliminado ${describeMovement(
              remoteMovement ?? localMovement,
              id
            )} reaparecio activo tras el merge.`,
          });
        }
        return;
      }

      if (!resolvedMovement || isDeletedMovement(resolvedMovement)) {
        violations.push({
          type: 'movement_missing_after_merge',
          path: `${field}.${id}`,
          message: `El movimiento visible ${describeMovement(
            remoteMovement ?? localMovement,
            id
          )} desaparecio tras el merge.`,
        });
      }
    });
  });

  return violations;
};

const collectClinicalConsistencyInvariantViolations = (
  result: ReturnType<typeof applyDailyRecordClinicalConsistencyCheck>
): DailyRecordConflictPostMergeInvariantViolation[] =>
  result.violations
    .filter(violation => violation.type === 'duplicate_active_patient')
    .map(violation => ({
      type: 'duplicate_active_patient_after_merge' as const,
      path: violation.path,
      message: violation.message,
    }));

export const evaluateDailyRecordConflictPostMergeInvariants = ({
  remote,
  local,
  resolved,
  context,
}: EvaluateDailyRecordConflictPostMergeInvariantsInput): DailyRecordConflictPostMergeInvariantResult => {
  const clinicalConsistency = applyDailyRecordClinicalConsistencyCheck(resolved, context);
  const violations = [
    ...collectMovementInvariantViolations({
      remote,
      local,
      resolved: clinicalConsistency.record,
    }),
    ...collectClinicalConsistencyInvariantViolations(clinicalConsistency),
  ];

  return {
    record: clinicalConsistency.record,
    status: violations.length > 0 ? 'blocked' : 'ok',
    violations,
  };
};
