import React from 'react';
import { CalendarClock } from 'lucide-react';

import { formatDateForDisplay } from '@/utils/dateDisplayUtils';

const parseLocalDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

interface CensusStaleDayBannerProps {
  /** The day currently being viewed (YYYY-MM-DD). */
  currentDateString: string;
  /** Active clinical day (YYYY-MM-DD, 08:00/09:00 shift rollover). */
  clinicalToday: string;
  /** Jump the selection back to the clinical day. */
  onGoToToday: () => void;
}

/**
 * Persistent banner shown whenever the census is parked on a day other than the
 * clinical "today" — the continuous, non-modal counterpart to the edit confirmation,
 * so a user who navigated away (or whose day rolled over) sees the mismatch and can
 * jump back in one click. Renders nothing when already on the clinical day.
 */
export const CensusStaleDayBanner: React.FC<CensusStaleDayBannerProps> = ({
  currentDateString,
  clinicalToday,
  onGoToToday,
}) => {
  if (!clinicalToday || currentDateString === clinicalToday) {
    return null;
  }

  const viewedLabel = formatDateForDisplay(parseLocalDate(currentDateString));
  const todayLabel = formatDateForDisplay(parseLocalDate(clinicalToday));

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-800 print:hidden"
    >
      <CalendarClock size={18} className="shrink-0 text-amber-600" aria-hidden="true" />
      <p className="flex-1 text-sm leading-snug">
        Estás viendo el <span className="font-semibold">{viewedLabel}</span>. El día de hoy es{' '}
        <span className="font-semibold">{todayLabel}</span>.
      </p>
      <button
        onClick={onGoToToday}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
      >
        <CalendarClock size={14} aria-hidden="true" />
        Ir a hoy
      </button>
    </div>
  );
};
