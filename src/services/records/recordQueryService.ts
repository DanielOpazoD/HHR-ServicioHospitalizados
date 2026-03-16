import { DailyRecord, PatientData } from '@/types/core';
import {
  getAllRecordsSorted,
  getRecordsForMonth,
  getRecordsRange,
  saveRecords as saveManyToIndexedDB,
} from '@/services/storage/records';
import { getRecordsRangeFromFirestore } from '@/services/storage/firestore';

export const fetchRecordsForMonth = async (year: number, month: number): Promise<DailyRecord[]> => {
  return getRecordsForMonth(year, month);
};

export const fetchExistingDaysInMonth = async (year: number, month: number): Promise<number[]> => {
  const records = await getRecordsForMonth(year, month);

  return records
    .filter(dayRecord => {
      if (!dayRecord || !dayRecord.beds) return false;

      // Check if day has any patients
      return Object.values(dayRecord.beds).some(bed => {
        const patient = bed as PatientData;
        return patient.patientName && patient.patientName.trim() !== '';
      });
    })
    .map(d => parseInt(d.date.split('-')[2]));
};

export const fetchAllRecordsSorted = async (): Promise<DailyRecord[]> => {
  return getAllRecordsSorted();
};

export const fetchRecordsRangeSorted = async (
  startDate: string,
  endDate: string
): Promise<DailyRecord[]> => {
  const rangeRecords = await getRecordsRange(startDate, endDate);
  return rangeRecords.sort((a, b) => b.date.localeCompare(a.date));
};

export const syncRecordsRange = async (start: string, end: string): Promise<DailyRecord[]> => {
  const remoteRecords = await getRecordsRangeFromFirestore(start, end);
  if (remoteRecords.length === 0) return [];

  await saveManyToIndexedDB(remoteRecords);
  return remoteRecords;
};
