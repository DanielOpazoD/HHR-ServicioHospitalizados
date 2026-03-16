import { useEffect, useState } from 'react';

import {
  buildArchiveStatusState,
  shouldCheckArchiveStatus,
} from '@/hooks/controllers/exportManagerController';
import { executeLookupBackupArchiveStatus } from '@/application/backup-export/backupExportUseCases';
import { presentBackupLookupOutcome } from '@/hooks/controllers/backupStorageOutcomeController';
import { recordOperationalOutcome } from '@/services/observability/operationalTelemetryService';

interface UseBackupArchiveStatusParams {
  currentDateString: string;
  currentModule: string;
  selectedShift: 'day' | 'night';
  canVerifyArchiveStatus: boolean;
  warning: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
}

export const useBackupArchiveStatus = ({
  currentDateString,
  currentModule,
  selectedShift,
  canVerifyArchiveStatus,
  warning,
  error,
}: UseBackupArchiveStatusParams) => {
  const [isArchived, setIsArchived] = useState(false);

  useEffect(() => {
    if (!canVerifyArchiveStatus || !shouldCheckArchiveStatus(currentDateString, currentModule)) {
      return;
    }

    const backupType = currentModule === 'CENSUS' ? 'census' : 'handoff';
    let isDisposed = false;
    let timeoutId: number | undefined;
    let idleCallbackId: number | undefined;

    const runLookup = () => {
      void executeLookupBackupArchiveStatus({
        backupType,
        date: currentDateString,
        shift: selectedShift,
      }).then(outcome => {
        if (isDisposed) {
          return;
        }

        recordOperationalOutcome('backup', 'lookup_archive_status', outcome, {
          date: currentDateString,
          context: { backupType, shift: selectedShift },
        });
        setIsArchived(buildArchiveStatusState(outcome.data.lookup));
        const notice = presentBackupLookupOutcome(outcome);
        if (notice?.channel === 'warning') {
          warning(notice.title || 'Respaldo', notice.message);
        } else if (notice?.channel === 'error') {
          error(notice.title || 'Respaldo', notice.message);
        }
      });
    };

    if (typeof window === 'undefined') {
      runLookup();
      return;
    }

    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof browserWindow.requestIdleCallback === 'function') {
      idleCallbackId = browserWindow.requestIdleCallback(() => {
        runLookup();
      });
    } else {
      timeoutId = window.setTimeout(() => {
        runLookup();
      }, 150);
    }

    return () => {
      isDisposed = true;
      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId);
      }
      if (
        typeof idleCallbackId === 'number' &&
        typeof browserWindow.cancelIdleCallback === 'function'
      ) {
        browserWindow.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [canVerifyArchiveStatus, currentDateString, currentModule, error, selectedShift, warning]);

  return {
    isArchived,
    setIsArchived,
  };
};
