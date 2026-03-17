import { formatDateDDMMYYYY } from '@/utils/dateUtils';

const parseIsoAtNoon = (isoDate: string): Date | null => {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export const formatCensusIsoDate = (isoDate: string, locale = 'es-CL'): string => {
  const parsed = parseIsoAtNoon(isoDate) ?? new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return parsed.toLocaleDateString(locale);
};

export const formatCensusShortDayMonth = (isoDate: string, locale = 'es-CL'): string => {
  const parsed = parseIsoAtNoon(isoDate);
  if (!parsed) {
    return '--/--';
  }

  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  void locale;
  return `${day}-${month}`;
};

export const formatCensusRouteDateLabel = (isoDate?: string): string =>
  isoDate ? formatDateDDMMYYYY(isoDate) : 'Sin fecha';

export const formatCensusMonthName = (isoDate: string, locale = 'es-CL'): string => {
  const parsed = parseIsoAtNoon(isoDate);
  if (!parsed) {
    return isoDate;
  }

  const monthName = parsed.toLocaleString(locale, { month: 'long' });
  return monthName.charAt(0).toUpperCase() + monthName.slice(1);
};
