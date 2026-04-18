export const DAILY_RECORD_STORE_CHANGED_EVENT = 'daily-record-store-changed';

export interface DailyRecordStoreChangedEventDetail {
  dates?: string[];
  operation: 'save' | 'delete' | 'clear';
}

const buildMonthPrefix = (year: number, monthOneBased: number): string =>
  `${year}-${String(monthOneBased).padStart(2, '0')}-`;

export const dispatchDailyRecordStoreChanged = (
  detail: DailyRecordStoreChangedEventDetail
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<DailyRecordStoreChangedEventDetail>(DAILY_RECORD_STORE_CHANGED_EVENT, {
      detail,
    })
  );
};

export const isDailyRecordStoreChangeRelevantToMonth = (
  detail: DailyRecordStoreChangedEventDetail | undefined,
  year: number,
  monthOneBased: number
): boolean => {
  if (!detail) {
    return true;
  }

  if (detail.operation === 'clear') {
    return true;
  }

  const monthPrefix = buildMonthPrefix(year, monthOneBased);
  return (detail.dates ?? []).some(date => date.startsWith(monthPrefix));
};
