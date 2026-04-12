export interface CensusDateSelection {
  year: number;
  month: number;
  day: number;
}

export const resolveCensusDateSelection = (isoDate: string): CensusDateSelection | null => {
  const datePart = isoDate.split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null;
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return { year, month: month - 1, day };
};
