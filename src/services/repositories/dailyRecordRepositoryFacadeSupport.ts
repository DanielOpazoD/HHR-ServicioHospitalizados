import { DailyRecord, DailyRecordPatch } from '@/types/core';
import { deleteRecord as deleteFromIndexedDB } from '@/services/storage/records';
import {
  deleteRecordFromFirestore,
  getRecordFromFirestore,
  moveRecordToTrash,
} from '../storage/firestore';
import { softDeleteDailyRecordRemote } from './dailyRecordRepositoryLifecycleSupport';
import { isFirestoreEnabled } from './repositoryConfig';
import {
  createCopyPatientToDateCommand,
  createDeleteDayCommand,
  createInitializeDayCommand,
} from './contracts/dailyRecordLifecycleCommands';
import {
  createGetDailyRecordQuery,
  createGetPreviousDayQuery,
} from './contracts/dailyRecordQueries';
import {
  createPartialUpdateDailyRecordCommand,
  createSaveDailyRecordCommand,
} from './contracts/dailyRecordCommands';

export const buildDailyRecordQuery = (date: string, syncFromRemote = true) =>
  createGetDailyRecordQuery(date, syncFromRemote);

export const buildPreviousDayQuery = (date: string) => createGetPreviousDayQuery(date);

export const buildSaveDailyRecordCommand = (record: DailyRecord, expectedLastUpdated?: string) =>
  createSaveDailyRecordCommand(record, expectedLastUpdated);

export const buildPartialUpdateDailyRecordCommand = (date: string, patch: DailyRecordPatch) =>
  createPartialUpdateDailyRecordCommand(date, patch);

export const buildInitializeDayCommand = (date: string, copyFromDate?: string) =>
  createInitializeDayCommand(date, copyFromDate);

export const buildCopyPatientToDateCommand = (
  sourceDate: string,
  sourceBedId: string,
  targetDate: string,
  targetBedId: string
) => createCopyPatientToDateCommand(sourceDate, sourceBedId, targetDate, targetBedId);

export const deleteDailyRecordAcrossStores = async (date: string): Promise<void> => {
  const command = createDeleteDayCommand(date);
  await deleteFromIndexedDB(command.date);
  await softDeleteDailyRecordRemote(command.date, {
    isRemoteEnabled: isFirestoreEnabled(),
    loadRecord: getRecordFromFirestore,
    moveToTrash: moveRecordToTrash,
    deleteRemote: deleteRecordFromFirestore,
  });
};
