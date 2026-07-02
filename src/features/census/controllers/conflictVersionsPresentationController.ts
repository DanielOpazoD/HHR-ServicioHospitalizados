type ConflictSnapshotRecoveryEvidence = {
  status?: 'saved' | 'failed';
  snapshotIds?: string[];
  origins?: string[];
  ttlMs?: number;
};

export type ConflictSnapshotRecoveryStateKind =
  | 'recoverable'
  | 'not_saved'
  | 'expired_or_unavailable'
  | 'unknown_empty';

export interface ConflictSnapshotRecoveryState {
  kind: ConflictSnapshotRecoveryStateKind;
  title: string;
  message: string;
}

export const resolveConflictSnapshotRecoveryState = ({
  date,
  snapshotCount,
  snapshotRecovery,
}: {
  date?: string;
  snapshotCount: number;
  snapshotRecovery?: ConflictSnapshotRecoveryEvidence | null;
}): ConflictSnapshotRecoveryState => {
  const day = date || 'este día';
  if (snapshotCount > 0) {
    return {
      kind: 'recoverable',
      title: 'Snapshots recuperables',
      message: `${snapshotCount} versiones en conflicto siguen disponibles para ${day}.`,
    };
  }

  if (snapshotRecovery?.status === 'failed') {
    return {
      kind: 'not_saved',
      title: 'Snapshots no guardados',
      message:
        `Observabilidad registró un conflicto automático para ${day}, ` +
        'pero los snapshots de recuperación no pudieron guardarse.',
    };
  }

  if (snapshotRecovery?.status === 'saved' && (snapshotRecovery.snapshotIds?.length || 0) > 0) {
    return {
      kind: 'expired_or_unavailable',
      title: 'Snapshots no disponibles',
      message:
        `Observabilidad registró snapshots de conflicto para ${day}, ` +
        'pero ya expiraron, fueron purgados por TTL o no están disponibles para el usuario actual.',
    };
  }

  return {
    kind: 'unknown_empty',
    title: 'Sin snapshots recuperables',
    message:
      `Para ${day} no hay snapshots recuperables de versiones en conflicto. ` +
      'Si observabilidad registró un conflicto automático, los snapshots pudieron no guardarse, ' +
      'haber expirado o no estar disponibles para el usuario actual.',
  };
};

export const resolveConflictVersionsEmptyMessage = (date?: string): string =>
  resolveConflictSnapshotRecoveryState({ date, snapshotCount: 0 }).message;
