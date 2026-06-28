import { executeWriteAuditEvent } from '@/application/audit/writeAuditEventUseCase';
import { getCurrentUserEmail } from '@/services/admin/utils/auditUtils';

export interface ConflictAuditDetails {
  /** Correlates the audit entry with the recoverable version snapshots in `conflictSnapshots/`. */
  conflictId?: string;
  changedPaths: string[];
  policyVersion: string;
  entryCount: number;
  strategyBreakdown: Record<string, number>;
  winnerBreakdown: Record<string, number>;
  reasonBreakdown: Record<string, number>;
  samplePaths: string[];
  assessment: {
    riskLevel: 'low' | 'medium' | 'high';
    reviewRecommended: boolean;
    reviewReasons: string[];
    localDominantPaths: string[];
    remoteProtectedPaths: string[];
  };
}

type ConflictLoggerFn = (date: string, details: ConflictAuditDetails) => Promise<void>;

let customConflictLogger: ConflictLoggerFn | null = null;

export const setRepositoryConflictLogger = (logger: ConflictLoggerFn | null): void => {
  customConflictLogger = logger;
};

export const logRepositoryConflictAutoMerged = async (
  date: string,
  details: ConflictAuditDetails
): Promise<void> => {
  if (customConflictLogger) {
    await customConflictLogger(date, details);
    return;
  }

  await executeWriteAuditEvent({
    userId: getCurrentUserEmail(),
    action: 'CONFLICT_AUTO_MERGED',
    entityType: 'dailyRecord',
    entityId: date,
    details: details as unknown as Record<string, unknown>,
    recordDate: date,
  });
};

export interface ConflictVersionRestoreAuditDetails {
  /** Snapshot document id that was restored. */
  snapshotId: string;
  /** Which side of the conflict it came from (e.g. remote_premerge / incoming_premerge). */
  origin: string;
  /** Correlates back to the conflict and its version snapshots. */
  conflictId?: string;
}

/**
 * Audits an admin restoring a daily-record version from the conflict panel. Permanent (the
 * recoverable snapshots themselves expire via TTL, but this trail does not). See
 * docs/ADR_CONFLICT_VERSION_RECOVERY.md.
 */
export const logRepositoryConflictVersionRestored = async (
  date: string,
  details: ConflictVersionRestoreAuditDetails
): Promise<void> => {
  // executeWriteAuditEvent never throws: it returns a failed ApplicationOutcome for an anonymous
  // clinical actor or an underlying write error. Surface that as a throw so the restore caller can
  // fail closed instead of silently overwriting the record without an audit row.
  const outcome = await executeWriteAuditEvent({
    userId: getCurrentUserEmail(),
    action: 'CONFLICT_VERSION_RESTORED',
    entityType: 'dailyRecord',
    entityId: date,
    details: details as unknown as Record<string, unknown>,
    recordDate: date,
  });
  if (outcome.status !== 'success') {
    throw new Error(
      outcome.issues[0]?.message ??
        outcome.userSafeMessage ??
        'No se pudo registrar la auditoría de restauración de versión en conflicto.'
    );
  }
};
