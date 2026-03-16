import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { StorageLookupResult } from '@/services/backup/storageLookupContracts';
import { resolveHandoffShiftStaff } from '@/services/staff/dailyRecordStaffing';

export const shouldCheckArchiveStatus = (
  currentDateString: string,
  currentModule: string
): boolean =>
  Boolean(currentDateString) && (currentModule === 'CENSUS' || currentModule === 'NURSING_HANDOFF');

export const mergeMonthlyRecordsForBackup = (
  monthRecords: DailyRecord[],
  currentRecord: DailyRecord | null,
  currentDateString: string,
  limitDate: string
): DailyRecord[] => {
  const filteredRecords = monthRecords
    .filter(record => record.date <= limitDate)
    .sort((left, right) => left.date.localeCompare(right.date));

  if (currentRecord && !filteredRecords.some(record => record.date === currentDateString)) {
    filteredRecords.push(currentRecord);
    filteredRecords.sort((left, right) => left.date.localeCompare(right.date));
  }

  return filteredRecords;
};

export const resolveHandoffBackupStaff = (
  record: DailyRecord,
  selectedShift: 'day' | 'night'
): { delivers: string[]; receives: string[] } => resolveHandoffShiftStaff(record, selectedShift);

export const buildArchiveStatusState = (result: StorageLookupResult): boolean => result.exists;
