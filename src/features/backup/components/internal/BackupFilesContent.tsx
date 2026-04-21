import React from 'react';
import clsx from 'clsx';
import { Folder, RefreshCw } from 'lucide-react';

import { FolderCard, FileCard } from './BackupDriveItems';
import { HandoffCalendarView } from './HandoffCalendarView';
import { DailyBackupCalendarView } from './DailyBackupCalendarView';
import type { BackupFolder, BackupItem, BackupType } from '@/hooks/backupFileBrowserContracts';
import { formatFileSize, type BaseStoredFile, type StoredPdfFile } from '@/types/backupArtifacts';

interface BackupFilesContentProps {
  items: BackupItem[];
  filteredItems: BackupItem[];
  path: string[];
  selectedBackupType: BackupType;
  viewMode: 'grid' | 'list';
  isLoading: boolean;
  isRefetching: boolean;
  canDelete: boolean;
  onPreviewFile: (file: BaseStoredFile | StoredPdfFile) => void;
  onOpenFolder: (folder: BackupFolder) => void;
  onDownloadFile: (file: BaseStoredFile | StoredPdfFile) => void;
  onDeleteFile: (file: BaseStoredFile | StoredPdfFile) => void;
}

export const BackupFilesContent: React.FC<BackupFilesContentProps> = ({
  items,
  filteredItems,
  path,
  selectedBackupType,
  viewMode,
  isLoading,
  isRefetching,
  canDelete,
  onPreviewFile,
  onOpenFolder,
  onDownloadFile,
  onDeleteFile,
}) => {
  if (isLoading && !isRefetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <RefreshCw className="w-12 h-12 text-slate-300 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Buscando archivos...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
        <Folder className="w-16 h-16 text-slate-200 mb-4" />
        <p className="text-slate-400 font-medium tracking-tight">
          No se encontraron respaldos en esta ubicación
        </p>
      </div>
    );
  }

  if (path.length === 2) {
    const currentYear = Number.parseInt(path[0], 10);
    const currentMonthName = path[1];
    const files = items
      .filter(item => item.type === 'file')
      .map(item => item.data as BaseStoredFile | StoredPdfFile);

    if (selectedBackupType === 'handoff') {
      return (
        <HandoffCalendarView
          files={files as StoredPdfFile[]}
          year={currentYear}
          monthName={currentMonthName}
          onView={file => onPreviewFile(file)}
          onDownload={file => onDownloadFile(file)}
          onDelete={onDeleteFile}
          canDelete={canDelete}
          formatSize={formatFileSize}
        />
      );
    }

    return (
      <DailyBackupCalendarView
        files={files}
        year={currentYear}
        monthName={currentMonthName}
        onView={file => onPreviewFile(file)}
        onDownload={file => onDownloadFile(file)}
        onDelete={onDeleteFile}
        canDelete={canDelete}
        formatSize={formatFileSize}
      />
    );
  }

  const isCompactView = selectedBackupType !== 'handoff';

  return (
    <div
      className={clsx(
        isCompactView ? 'gap-2' : 'gap-4',
        viewMode === 'grid'
          ? isCompactView
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'flex flex-col'
      )}
    >
      {filteredItems.map((item, index) =>
        item.type === 'folder' ? (
          <FolderCard
            key={(item.data as BackupFolder).name}
            name={(item.data as BackupFolder).name}
            onClick={() => onOpenFolder(item.data as BackupFolder)}
          />
        ) : (
          <FileCard
            key={(item.data as BaseStoredFile).fullPath || index}
            name={(item.data as BaseStoredFile).name}
            date={(item.data as BaseStoredFile).date}
            shift={(item.data as StoredPdfFile).shiftType || 'day'}
            size={formatFileSize((item.data as BaseStoredFile).size)}
            onView={() => onPreviewFile(item.data as BaseStoredFile | StoredPdfFile)}
            onDownload={() => onDownloadFile(item.data as BaseStoredFile | StoredPdfFile)}
            onDelete={() => onDeleteFile(item.data as BaseStoredFile | StoredPdfFile)}
            canDelete={canDelete}
            hideShift={selectedBackupType !== 'handoff'}
            compact={selectedBackupType !== 'handoff'}
          />
        )
      )}
    </div>
  );
};
