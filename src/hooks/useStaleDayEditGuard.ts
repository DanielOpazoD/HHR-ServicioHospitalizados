import { useCallback, useRef } from 'react';

import { useUI } from '@/context/UIContext';
import { useAuditContext } from '@/context/AuditContext';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import { resolveStaleDayEditDecision } from '@/hooks/controllers/staleDayEditController';
import { getPreviousDay } from '@/utils/clinicalDayUtils';
import { formatDateForDisplay } from '@/utils/dateDisplayUtils';

/** Gate the bed-management dispatcher calls before editing a record's day. */
export type StaleDayEditGuard = (recordDate: string) => Promise<boolean>;

const parseLocalDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Guards edits made to a clinical day other than the clinical "today".
 *
 * The first time the user edits a given stale (past) day in this session, it asks
 * for an explicit confirmation that names both concrete dates and records a
 * PREVIOUS_DAY_EDIT_CONFIRMED audit event; afterwards that day is remembered so
 * edits flow without re-prompting (one confirm per day, not per keystroke).
 *
 * Returns a callback the bed-management dispatcher calls before mutating: it
 * resolves to true to proceed, false to abort. Self-contained — it reads the
 * reactive clinical day, the confirm dialog, and the audit logger from context.
 */
export const useStaleDayEditGuard = (): ((recordDate: string) => Promise<boolean>) => {
  const clinicalToday = useClinicalToday();
  const { confirm } = useUI();
  const { logEvent } = useAuditContext();
  const confirmedDaysRef = useRef<Set<string>>(new Set());

  return useCallback(
    async (recordDate: string): Promise<boolean> => {
      const decision = resolveStaleDayEditDecision({
        currentDateString: recordDate,
        clinicalToday,
        alreadyConfirmed: confirmedDaysRef.current.has(recordDate),
      });
      if (decision === 'allowed') {
        return true;
      }

      const isYesterday = getPreviousDay(clinicalToday) === recordDate;
      const viewedLabel = formatDateForDisplay(parseLocalDate(recordDate));
      const todayLabel = formatDateForDisplay(parseLocalDate(clinicalToday));

      const confirmed = await confirm({
        variant: 'warning',
        title: '¿Editar un día anterior?',
        message:
          `Estás por modificar el ${viewedLabel}${isYesterday ? ' (ayer)' : ''}. ` +
          `El día de hoy es ${todayLabel}. El cambio quedará registrado en la auditoría.`,
        confirmText: 'Sí, editar ese día',
        cancelText: 'Ir a hoy',
      });
      if (!confirmed) {
        return false;
      }

      confirmedDaysRef.current.add(recordDate);
      logEvent(
        'PREVIOUS_DAY_EDIT_CONFIRMED',
        'dailyRecord',
        recordDate,
        { viewedDate: recordDate, clinicalToday },
        undefined,
        recordDate
      );
      return true;
    },
    [clinicalToday, confirm, logEvent]
  );
};
