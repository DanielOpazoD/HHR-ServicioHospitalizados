import React from 'react';
import * as ExportService from '@/services/exporters/exportService';
import type { DailyRecord } from '@/hooks/contracts/dailyRecordHookContracts';
import { useNotification } from '@/context/UIContext';
import { buildJsonImportNotifications } from '@/hooks/controllers/fileImportFeedbackController';
import {
  buildExportCsvNotification,
  buildExportJsonNotification,
  buildImportFileErrorNotification,
} from '@/hooks/controllers/fileOperationsFeedbackController';
import {
  isJsonImportFile,
  shouldRefreshAfterJsonImport,
} from '@/hooks/controllers/fileOperationsController';
import { executeImportJsonBackup } from '@/application/backup-export/backupExportUseCases';
import { presentBackupExportOutcome } from '@/hooks/controllers/backupExportOutcomeController';
import {
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';

export interface UseFileOperationsReturn {
  handleExportJSON: () => void;
  handleExportCSV: () => void;
  handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleImportFile: (file: File) => Promise<void>;
}

/**
 * Hook to manage file import/export operations
 * Extracts file handling logic from App.tsx for cleaner separation of concerns
 */
export const useFileOperations = (
  record: DailyRecord | null,
  onRefresh: () => void
): UseFileOperationsReturn => {
  const { success, error, warning } = useNotification();
  const dispatchNotification = (notification: {
    channel: 'success' | 'warning' | 'error';
    title: string;
    message?: string;
  }) => {
    if (notification.channel === 'success') {
      success(notification.title, notification.message);
    } else if (notification.channel === 'warning') {
      warning(notification.title, notification.message);
    } else {
      error(notification.title, notification.message);
    }
  };

  const handleExportJSON = () => {
    void ExportService.exportDataJSONWithResult()
      .then(outcome => {
        if (outcome.status === 'success') {
          dispatchNotification(buildExportJsonNotification('success'));
          return;
        }
        dispatchNotification(buildExportJsonNotification('error'));
      })
      .catch(() => {
        dispatchNotification(buildExportJsonNotification('error'));
      });
  };

  const handleExportCSV = () => {
    const outcome = ExportService.exportDataCSVWithResult(record);
    if (outcome.status === 'success') {
      dispatchNotification(buildExportCsvNotification('success'));
      return;
    }

    dispatchNotification(buildExportCsvNotification('error'));
  };

  const handleImportFile = async (file: File) => {
    if (isJsonImportFile(file)) {
      const outcome = await executeImportJsonBackup(file);
      recordOperationalOutcome('backup', 'import_json_backup', outcome, {
        context: { fileName: file.name },
        allowSuccess: true,
      });
      if (outcome.status === 'success' || outcome.status === 'partial') {
        for (const notification of buildJsonImportNotifications(outcome.data)) {
          dispatchNotification(notification);
        }
        if (shouldRefreshAfterJsonImport(outcome.data)) {
          onRefresh();
        }
      } else {
        const notice = presentBackupExportOutcome(outcome, {
          successTitle: 'Importación completada',
          partialTitle: 'Importación completada con observaciones',
          failedTitle: 'Error al importar',
          fallbackErrorMessage: 'No se pudo importar el archivo JSON.',
        });
        dispatchNotification({
          channel: notice.channel === 'info' ? 'warning' : notice.channel,
          title: notice.title,
          message: notice.message,
        });
      }
    } else {
      recordOperationalTelemetry({
        category: 'backup',
        status: 'failed',
        operation: 'import_json_backup',
        issues: ['Se intentó importar un formato no compatible.'],
        context: { fileName: file.name, mimeType: file.type || 'unknown' },
      });
      dispatchNotification(buildImportFileErrorNotification('invalid_format'));
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleImportFile(e.target.files[0]);
      // Reset input
      e.target.value = '';
    }
  };

  return {
    handleExportJSON,
    handleExportCSV,
    handleImportJSON,
    handleImportFile,
  };
};
