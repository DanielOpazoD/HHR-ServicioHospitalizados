export const formatDateDDMMYYYY = (isoDate?: string): string => {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
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

/**
 * Formats an ISO date-time as a short es-CL date + time
 * (e.g. `25-06-2026, 16:30`). Returns the original input unchanged when it is
 * not a parseable date, matching the prescriptions/wound-care display contract.
 */
export const formatDateTimeCL = (isoDateTime: string): string => {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;

  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
