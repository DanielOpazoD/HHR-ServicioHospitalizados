import { DateRangePreset } from '@/types/minsalTypes';

/** Calculate date range from preset. */
export function getDateRangeFromPreset(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
  currentYearMonth?: number
): { startDate: string; endDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDate = (d: Date): string => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { startDate: formatDate(today), endDate: formatDate(today) };

    case 'last7days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }

    case 'lastMonth': {
      // Rolling 30 days including today
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }

    case 'currentMonth': {
      // Configurable month in current year.
      const normalizedMonth = Math.min(12, Math.max(1, currentYearMonth ?? today.getMonth() + 1));
      const monthIndex = normalizedMonth - 1;
      const year = today.getFullYear();
      const start = new Date(year, monthIndex, 1);
      const end = monthIndex === today.getMonth() ? today : new Date(year, monthIndex + 1, 0);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }

    case 'yearToDate': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }

    case 'last3Months': {
      const start = new Date(today);
      start.setDate(start.getDate() - 89);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }

    case 'last6Months': {
      const start = new Date(today);
      start.setDate(start.getDate() - 179);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }

    case 'last12Months': {
      const start = new Date(today);
      start.setDate(start.getDate() - 364);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }

    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('Custom date range requires start and end dates');
      }
      return { startDate: customStart, endDate: customEnd };

    default:
      return { startDate: formatDate(today), endDate: formatDate(today) };
  }
}
