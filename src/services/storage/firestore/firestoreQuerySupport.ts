import { DailyRecord } from '@/types';

const padDatePart = (value: number): string => String(value).padStart(2, '0');

export const buildFirestoreMonthDateRange = (
  year: number,
  monthIndex: number
): { startDate: string; endDate: string } => ({
  startDate: `${year}-${padDatePart(monthIndex + 1)}-01`,
  endDate: `${year}-${padDatePart(monthIndex + 1)}-31`,
});

export const mapFirestoreRecords = <T>(
  docs: Array<{ id: string; data: () => T }>,
  mapper: (data: T, id: string) => DailyRecord
): DailyRecord[] => docs.map(docItem => mapper(docItem.data(), docItem.id));

export const toFirestoreRecordMap = (records: DailyRecord[]): Record<string, DailyRecord> =>
  records.reduce<Record<string, DailyRecord>>((acc, record) => {
    acc[record.date] = record;
    return acc;
  }, {});
