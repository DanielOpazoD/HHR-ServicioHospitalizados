/**
 * Fail-closed deletion of a whole daily record.
 *
 * Deleting a daily census record removes clinical data, so it is audited and **fails closed**: the
 * DAILY_RECORD_DELETED audit is written FIRST, and only if it succeeds is the record deleted — an
 * anonymous actor or a failed audit write aborts before any deletion (no unaudited clinical-record
 * delete, Ley 20.584). See docs/CLINICAL_MUTATION_AUDIT_POLICY.md.
 */
import { executeWriteAuditEvent } from '@/application/audit/writeAuditEventUseCase';
import { getCurrentUserEmail } from '@/services/admin/utils/auditUtils';
import {
  createApplicationFailed,
  createApplicationSuccess,
} from '@/shared/contracts/applicationOutcomeFactories';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';

export interface DeleteDailyRecordInput {
  date: string;
  /** Performs the actual cross-store deletion (injected so the use-case stays port-agnostic). */
  deleteRecord: (date: string) => Promise<void>;
}

export interface DeleteDailyRecordDeps {
  writeAuditEvent?: typeof executeWriteAuditEvent;
  deletedBy?: string;
}

export const executeDeleteDailyRecord = async (
  input: DeleteDailyRecordInput,
  deps: DeleteDailyRecordDeps = {}
): Promise<ApplicationOutcome<null>> => {
  const writeAuditEvent = deps.writeAuditEvent || executeWriteAuditEvent;

  const auditOutcome = await writeAuditEvent({
    userId: deps.deletedBy || getCurrentUserEmail(),
    action: 'DAILY_RECORD_DELETED',
    entityType: 'dailyRecord',
    entityId: input.date,
    recordDate: input.date,
    details: { date: input.date },
  });
  if (auditOutcome.status === 'failed') {
    return auditOutcome;
  }

  try {
    await input.deleteRecord(input.date);
    return createApplicationSuccess(null);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message:
          error instanceof Error ? error.message : 'No se pudo eliminar el registro del día.',
      },
    ]);
  }
};
