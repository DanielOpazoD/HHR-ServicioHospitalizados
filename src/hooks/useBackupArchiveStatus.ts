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
  warning: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
}

export const useBackupArchiveStatus = ({
  currentDateString,
  currentModule,
  selectedShift,
  warning,
  error,
}: UseBackupArchiveStatusParams) => {
  const [isArchived, setIsArchived] = useState(false);

  useEffect(() => {
    if (!shouldCheckArchiveStatus(currentDateString, currentModule)) {
      return;
    }

    const backupType = currentModule === 'CENSUS' ? 'census' : 'handoff';

    void executeLookupBackupArchiveStatus({
      backupType,
      date: currentDateString,
      shift: selectedShift,
    }).then(outcome => {
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
  }, [currentDateString, currentModule, error, selectedShift, warning]);

  return {
    isArchived,
    setIsArchived,
  };
};
