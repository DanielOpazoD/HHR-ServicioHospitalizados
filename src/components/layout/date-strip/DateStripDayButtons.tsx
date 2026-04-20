import React from 'react';
import clsx from 'clsx';
import {
  resolveDateStripDayWindow,
  resolveIsFutureDayBlocked,
} from '@/components/layout/date-strip/dateStripDayWindowController';
import type { ModuleType } from '@/constants/navigationConfig';

interface DateStripDayButtonsProps {
  selectedDay: number;
  setSelectedDay: React.Dispatch<React.SetStateAction<number>>;
  daysInMonth: number;
  existingDaysInMonth: number[];
  selectedYear: number;
  selectedMonth: number;
  isCurrentMonth: boolean;
  today: Date;
  currentModule?: ModuleType;
}

export const DateStripDayButtons: React.FC<DateStripDayButtonsProps> = ({
  selectedDay,
  setSelectedDay,
  daysInMonth,
  existingDaysInMonth,
  selectedYear,
  selectedMonth,
  isCurrentMonth,
  today,
  currentModule,
}) => {
  const [windowWidth, setWindowWidth] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  const existingDaysSet = React.useMemo(() => new Set(existingDaysInMonth), [existingDaysInMonth]);

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { startDay, endDay } = resolveDateStripDayWindow({
    selectedDay,
    daysInMonth,
    windowWidth,
    currentModule,
  });

  const dayButtons = Array.from(
    { length: Math.max(0, endDay - startDay + 1) },
    (_, index): React.ReactNode => {
      const day = startDay + index;
      const hasData = existingDaysSet.has(day);
      const isSelected = day === selectedDay;
      const isTodayReal = isCurrentMonth && today.getDate() === day;
      const isFutureBlocked = resolveIsFutureDayBlocked({
        selectedYear,
        selectedMonth,
        day,
        referenceDate: today,
      });

      return (
        <button
          key={day}
          onClick={() => !isFutureBlocked && setSelectedDay(day)}
          disabled={isFutureBlocked}
          className={clsx(
            'flex items-center justify-center w-8 h-8 rounded-lg text-xs font-semibold transition-all shrink-0 relative border',
            isFutureBlocked
              ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
              : isSelected
                ? isTodayReal
                  ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold border-transparent shadow-lg shadow-blue-500/30 scale-110 ring-2 ring-blue-400/30'
                  : 'bg-slate-500 text-white font-bold border-slate-500 shadow-sm scale-105'
                : [
                    isTodayReal
                      ? 'bg-blue-50 border-blue-400 text-blue-600 font-bold ring-1 ring-blue-300/50 hover:bg-blue-100'
                      : 'bg-white border-slate-200/80 text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                  ]
          )}
        >
          <span>{day}</span>
          {hasData && (
            <span
              className={clsx(
                'absolute -bottom-0.5 w-1 h-1 rounded-full',
                isFutureBlocked ? 'bg-slate-300' : isSelected ? 'bg-green-400' : 'bg-green-500'
              )}
            />
          )}
        </button>
      );
    }
  );

  return <>{dayButtons}</>;
};
