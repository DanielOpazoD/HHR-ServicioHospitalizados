import React, { useMemo } from 'react';
import { useDailyRecordData } from '@/context/DailyRecordContext';
import { HandoffCudyrPrintHeader } from './HandoffCudyrPrintHeader';
import { HandoffCudyrPrintTable } from './HandoffCudyrPrintTable';
import {
  buildCudyrPrintMetrics,
  formatCudyrPrintDate,
  resolveResponsibleNightNurses,
  resolveVisibleCudyrBeds,
} from './handoffCudyrPrintSupport';

export const HandoffCudyrPrint: React.FC = () => {
  const { record } = useDailyRecordData();

  const visibleBeds = useMemo(() => resolveVisibleCudyrBeds(record), [record]);
  const metrics = useMemo(() => buildCudyrPrintMetrics(record), [record]);

  if (!record) return null;

  const printDate = formatCudyrPrintDate(record.date);
  const responsibleNurses = resolveResponsibleNightNurses(record);
  const lastCudyrTimestamp = record.cudyrUpdatedAt ?? record.cudyrLockedAt;

  return (
    <div className="handoff-cudyr-print list-none bg-white print:m-0 print:bg-white print:p-0">
      <HandoffCudyrPrintHeader
        occupied={metrics.occupied}
        categorized={metrics.categorized}
        index={metrics.index}
        printDate={printDate}
        lastCudyrTimestamp={lastCudyrTimestamp}
        responsibleNurses={responsibleNurses}
      />
      <HandoffCudyrPrintTable record={record} visibleBeds={visibleBeds} />
    </div>
  );
};
