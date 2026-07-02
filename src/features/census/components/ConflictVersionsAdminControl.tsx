import React from 'react';
import { History } from 'lucide-react';
import { BaseModalContent } from '@/components/shared/baseModalContent';
import { useConflictVersionRecovery } from '@/features/census/hooks/useConflictVersionRecovery';
import { resolveConflictVersionsEmptyMessage } from '@/features/census/controllers/conflictVersionsPresentationController';
import type {
  ConflictVersionSnapshot,
  DailyRecordConflictRecoveryPort,
} from '@/application/ports/dailyRecordConflictRecoveryPort';

const ORIGIN_LABEL: Record<string, string> = {
  remote_premerge: 'Versión en la nube (remota)',
  incoming_premerge: 'Versión local (entrante)',
};

const summarizeSnapshot = (snapshot: ConflictVersionSnapshot): string => {
  const beds = snapshot.record?.beds ?? {};
  const patientCount = Object.values(beds).filter(bed =>
    (bed as { patientName?: string })?.patientName?.trim()
  ).length;
  const time = snapshot.sourceLastUpdated ? snapshot.sourceLastUpdated.slice(11, 16) : '';
  return `${patientCount} paciente(s) en cama${time ? ` · base ${time}` : ''}`;
};

interface ConflictVersionsAdminControlProps {
  date?: string;
  /** Injectable for tests/stories; defaults to the real port. */
  port?: DailyRecordConflictRecoveryPort;
}

/**
 * Subtle, admin-only census affordance to recover a daily-record version after a conflict/merge.
 * Renders nothing for non-admins. See docs/ADR_CONFLICT_VERSION_RECOVERY.md.
 */
export const ConflictVersionsAdminControl: React.FC<ConflictVersionsAdminControlProps> = ({
  date,
  port,
}) => {
  const model = useConflictVersionRecovery({ date, port });

  if (!model.isAdmin || !date) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={model.open}
        title="Versiones en conflicto del día (admin)"
        aria-label="Versiones en conflicto del día"
        data-testid="conflict-versions-button"
        className="self-center text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
      >
        <History size={16} />
      </button>

      <BaseModalContent
        isOpen={model.isOpen}
        onClose={model.close}
        title="Versiones en conflicto del día"
        size="md"
        dataTestId="conflict-versions-modal"
      >
        {model.loading ? (
          <p className="py-6 text-center text-sm text-slate-500">Cargando versiones…</p>
        ) : model.snapshots.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {resolveConflictVersionsEmptyMessage(date)}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {model.snapshots.map(snapshot => (
              <li key={snapshot.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">
                    {ORIGIN_LABEL[snapshot.origin] ?? snapshot.origin}
                  </p>
                  <p className="truncate text-xs text-slate-500">{summarizeSnapshot(snapshot)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void model.restore(snapshot.id)}
                  disabled={model.restoringId !== null}
                  className="shrink-0 rounded-md border border-accent-200 px-2.5 py-1 text-xs font-medium text-accent-700 hover:bg-accent-50 hover:text-accent-800 disabled:opacity-50"
                >
                  {model.restoringId === snapshot.id ? 'Restaurando…' : 'Restaurar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </BaseModalContent>
    </>
  );
};
