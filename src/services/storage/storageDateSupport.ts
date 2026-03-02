export const buildMonthRecordPrefix = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`;
