import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useConfirmDialog, useNotification } from '@/context/UIContext';
import {
  defaultDailyRecordConflictRecoveryPort,
  type ConflictSnapshotRecoveryEvidence,
  type ConflictVersionSnapshot,
  type DailyRecordConflictRecoveryPort,
} from '@/application/ports/dailyRecordConflictRecoveryPort';

interface UseConflictVersionRecoveryOptions {
  date?: string;
  port?: DailyRecordConflictRecoveryPort;
}

export interface ConflictVersionRecoveryModel {
  isAdmin: boolean;
  isOpen: boolean;
  loading: boolean;
  restoringId: string | null;
  snapshots: ConflictVersionSnapshot[];
  snapshotRecovery: ConflictSnapshotRecoveryEvidence | null;
  open: () => void;
  close: () => void;
  restore: (snapshotId: string) => Promise<void>;
}

/**
 * Admin-only model for the census "conflict versions" affordance: lists the recoverable conflict
 * snapshots for a day and restores one (with confirmation + notifications). All restores are
 * audited server-side. See docs/ADR_CONFLICT_VERSION_RECOVERY.md.
 */
export const useConflictVersionRecovery = ({
  date,
  port = defaultDailyRecordConflictRecoveryPort,
}: UseConflictVersionRecoveryOptions): ConflictVersionRecoveryModel => {
  const { role } = useAuth();
  const { confirm } = useConfirmDialog();
  const { success, error: notifyError } = useNotification();
  const isAdmin = role === 'admin';

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<ConflictVersionSnapshot[]>([]);
  const [snapshotRecovery, setSnapshotRecovery] = useState<ConflictSnapshotRecoveryEvidence | null>(
    null
  );

  // CensusStaffHeader keeps this hook mounted across day changes (only the `date` prop changes).
  // Reset on date change so a stale, still-open list can never restore an old snapshotId against the
  // new day (the snapshot lives in the previous day's subcollection).
  useEffect(() => {
    setIsOpen(false);
    setLoading(false);
    setRestoringId(null);
    setSnapshots([]);
    setSnapshotRecovery(null);
  }, [date]);

  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const [nextSnapshots, nextSnapshotRecovery] = await Promise.all([
        port.listConflictVersionSnapshots(date),
        port.getLatestConflictSnapshotRecovery?.(date) ?? Promise.resolve(null),
      ]);
      setSnapshots(nextSnapshots);
      setSnapshotRecovery(nextSnapshotRecovery);
    } catch {
      notifyError('No se pudieron cargar las versiones en conflicto.');
      setSnapshots([]);
      setSnapshotRecovery(null);
    } finally {
      setLoading(false);
    }
  }, [date, port, notifyError]);

  const open = useCallback(() => {
    setIsOpen(true);
    void load();
  }, [load]);

  const close = useCallback(() => setIsOpen(false), []);

  const restore = useCallback(
    async (snapshotId: string) => {
      if (!date) return;
      const confirmed = await confirm({
        title: 'Restaurar versión',
        message:
          'Se reemplazará el registro del día con esta versión. El estado actual quedará ' +
          'guardado en el historial y la acción quedará auditada.',
        confirmText: 'Restaurar',
        cancelText: 'Cancelar',
        variant: 'warning',
      });
      if (!confirmed) return;

      setRestoringId(snapshotId);
      try {
        const result = await port.restoreDailyRecordVersion(date, snapshotId);
        if (result.status === 'restored') {
          success('Versión restaurada', 'El registro del día fue restaurado.');
          setIsOpen(false);
        } else {
          notifyError('La versión ya no está disponible.');
          void load();
        }
      } catch {
        notifyError('No se pudo restaurar la versión.');
      } finally {
        setRestoringId(null);
      }
    },
    [date, port, confirm, success, notifyError, load]
  );

  return {
    isAdmin,
    isOpen,
    loading,
    restoringId,
    snapshots,
    snapshotRecovery,
    open,
    close,
    restore,
  };
};
