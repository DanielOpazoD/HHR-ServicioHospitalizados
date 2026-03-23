export const formatDateDDMMYYYY = (isoDate?: string): string => {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

export const getTodayISO = (): string => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

export const formatDateForDisplay = (date: Date): string =>
  date.toLocaleDateString('es-CL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export const formatTimeHHMM = (isoDateTime?: string): string => {
  if (!isoDateTime) return '--:--';

  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return '--:--';

  return date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export const daysBetween = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getTimeRoundedToStep = (date: Date = new Date(), stepMinutes = 5): string => {
  const stepMs = stepMinutes * 60 * 1000;
  const roundedMs = Math.round(date.getTime() / stepMs) * stepMs;
  return new Date(roundedMs).toTimeString().slice(0, 5);
};

export const isFutureDate = (dateString: string): boolean => dateString > getTodayISO();

export const parseISODate = (isoDate?: string): Date | null => {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  return isNaN(date.getTime()) ? null : date;
};

export const getDaysInMonth = (year: number, month: number): number =>
  new Date(year, month, 0).getDate();

export const generateDateRange = (
  year: number,
  month: number,
  limitToToday: boolean = false
): string[] => {
  const days = getDaysInMonth(year, month);
  const range: string[] = [];
  const monthStr = String(month).padStart(2, '0');
  const today = getTodayISO();

  for (let day = 1; day <= days; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    if (limitToToday && dateStr > today) {
      break;
    }
    range.push(dateStr);
  }

  return range;
};
