const padDatePart = (value: number): string => String(value).padStart(2, '0');

export const buildMonthIntegrityDate = (year: number, month: number, day: number): string =>
  `${year}-${padDatePart(month)}-${padDatePart(day)}`;

export const getPreviousMonthIntegrityDate = (
  year: number,
  month: number,
  day: number
): string | undefined => (day > 1 ? buildMonthIntegrityDate(year, month, day - 1) : undefined);

export const buildMonthIntegrityDateRange = (
  year: number,
  month: number,
  upToDay: number
): string[] => {
  const dates: string[] = [];
  for (let day = 1; day <= upToDay; day += 1) {
    dates.push(buildMonthIntegrityDate(year, month, day));
  }
  return dates;
};

export interface MonthIntegrityResult {
  success: boolean;
  initializedDays: string[];
  errors: string[];
  totalDays: number;
}

export const createMonthIntegrityResult = (
  initializedDays: string[],
  errors: string[],
  totalDays: number
): MonthIntegrityResult => ({
  success: errors.length === 0,
  initializedDays,
  errors,
  totalDays,
});
