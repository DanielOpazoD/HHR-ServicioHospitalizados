/**
 * useBackupFilesQuery Hook
 * TanStack Query wrapper for backup file listing.
 * Natively resolves race conditions when navigating between folders.
 */

import { useQuery } from '@tanstack/react-query';
import {
  listYears as listHandoffYears,
  listMonths as listHandoffMonths,
  listFilesInMonth as listHandoffFiles,
  listFilesInMonthWithReport as listHandoffFilesWithReport,
} from '@/services/backup/pdfStorageService';
import {
  listCensusYears,
  listCensusMonths,
  listCensusFilesInMonth,
  listCensusFilesInMonthWithReport,
} from '@/services/backup/censusStorageService';
import {
  listCudyrYears,
  listCudyrMonths,
  listCudyrFilesInMonth,
  listCudyrFilesInMonthWithReport,
} from '@/services/backup/cudyrStorageService';
import {
  MONTH_NAMES,
  BaseStoredFile,
  type StorageListReport,
} from '@/services/backup/baseStorageService';
import { StoredPdfFile } from '@/services/backup/pdfStorageService';

export type BackupItemType = 'folder' | 'file';

export interface BackupFolder {
  name: string;
  type: 'year' | 'month';
  number?: string;
}

export interface BackupItem {
  type: BackupItemType;
  data: BackupFolder | StoredPdfFile | BaseStoredFile;
}

const EMPTY_STORAGE_LIST_REPORT: StorageListReport = {
  skippedNotFound: 0,
  skippedRestricted: 0,
  skippedUnknown: 0,
  skippedUnparsed: 0,
  timedOut: false,
};

const monthNameToNumber = (name: string): string => {
  const index = MONTH_NAMES.indexOf(name);
  return String(index + 1).padStart(2, '0');
};

export const useBackupFilesQuery = (backupType: string, path: string[]) => {
  const query = useQuery({
    queryKey: ['backups', backupType, ...path],
    queryFn: async (): Promise<{ items: BackupItem[]; report: StorageListReport }> => {
      // console.debug(`[useBackupFilesQuery] 📂 Fetching ${backupType} backups for path: /${path.join('/')}`);

      // 1. Determine service based on type
      const service = {
        listYears:
          backupType === 'handoff'
            ? listHandoffYears
            : backupType === 'census'
              ? listCensusYears
              : listCudyrYears,
        listMonths:
          backupType === 'handoff'
            ? listHandoffMonths
            : backupType === 'census'
              ? listCensusMonths
              : listCudyrMonths,
        listFilesInMonth:
          backupType === 'handoff'
            ? listHandoffFiles
            : backupType === 'census'
              ? listCensusFilesInMonth
              : listCudyrFilesInMonth,
        listFilesInMonthWithReport:
          backupType === 'handoff'
            ? listHandoffFilesWithReport
            : backupType === 'census'
              ? listCensusFilesInMonthWithReport
              : listCudyrFilesInMonthWithReport,
      };

      if (path.length === 0) {
        // Root: List years
        // console.debug('[useBackupFilesQuery] 📅 Fetching years...');
        const years = await service.listYears();
        // console.debug(`[useBackupFilesQuery] ✅ Found years: ${years.join(', ')}`);
        return {
          items: years.map(year => ({
            type: 'folder',
            data: { name: year, type: 'year' },
          })),
          report: EMPTY_STORAGE_LIST_REPORT,
        };
      } else if (path.length === 1) {
        // Year: List months
        const year = path[0];
        // console.debug(`[useBackupFilesQuery] 📅 Fetching months for year: ${year}`);
        const months = await service.listMonths(year);
        // console.debug(`[useBackupFilesQuery] ✅ Found months: ${months.length}`);
        return {
          items: months.map(month => ({
            type: 'folder',
            data: { name: month.name, number: month.number, type: 'month' },
          })),
          report: EMPTY_STORAGE_LIST_REPORT,
        };
      } else if (path.length === 2) {
        // Month: List files
        const year = path[0];
        const monthName = path[1];
        const monthNumber = monthNameToNumber(monthName);

        // console.debug(`[useBackupFilesQuery] 📄 Fetching files for ${year}/${monthNumber} (${monthName})`);
        const filesResult = await service.listFilesInMonthWithReport(year, monthNumber);
        // console.debug(`[useBackupFilesQuery] ✅ Found files: ${files.length}`);

        return {
          items: filesResult.files.map(file => ({
            type: 'file',
            data: file,
          })),
          report: filesResult.report,
        };
      }

      return { items: [], report: EMPTY_STORAGE_LIST_REPORT };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    ...query,
    data: query.data?.items ?? [],
    storageReport: query.data?.report ?? EMPTY_STORAGE_LIST_REPORT,
  };
};
