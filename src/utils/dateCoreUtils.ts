export const getTodayISO = (): string => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

export const isFutureDate = (dateString: string): boolean => dateString > getTodayISO();

export const parseISODate = (isoDate?: string): Date | null => {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  return isNaN(date.getTime()) ? null : date;
};
