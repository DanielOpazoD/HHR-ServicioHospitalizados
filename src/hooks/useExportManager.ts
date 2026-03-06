import { useState, useEffect, useCallback } from 'react';
import { DailyRecord } from '@/types';
import { checkCensusExistsDetailed } from '@/services/backup/censusStorageService';
import { useConfirmDialog, useNotification } from '@/context/UIContext';
import {
  buildArchiveStatusState,
  resolveHandoffBackupStaff,
  shouldCheckArchiveStatus,
} from '@/hooks/controllers/exportManagerController';
import { getStorageLookupNotice } from '@/services/backup/storageUiPolicy';
import {
  executeBackupCensusExcel,
  executeBackupHandoffPdf,
  executeExportHandoffPdf,
} from '@/application/backup-export/backupExportUseCases';
import { presentBackupExportOutcome } from '@/hooks/controllers/backupExportOutcomeController';

interface UseExportManagerProps {
  currentDateString: string;
  selectedYear: number;
  selectedMonth: number;
  selectedDay: number;
  record: DailyRecord | null;
  currentModule: string;
  selectedShift: 'day' | 'night';
}

export interface UseExportManagerReturn {
  isArchived: boolean;
  isBackingUp: boolean;
  handleExportPDF: () => Promise<void>;
  handleBackupExcel: () => Promise<void>;
  handleBackupHandoff: (skipConfirmation?: boolean) => Promise<void>;
}

export const useExportManager = ({
  currentDateString,
  selectedYear,
  selectedMonth,
  selectedDay,
  record,
  currentModule,
  selectedShift,
}: UseExportManagerProps): UseExportManagerReturn => {
  const { success, error: notifyError, warning } = useNotification();
  const { confirm } = useConfirmDialog();

  // Track if current date's census or handoff is already archived
  const [isArchived, setIsArchived] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Check archive status when date/module changes
  useEffect(() => {
    if (!shouldCheckArchiveStatus(currentDateString, currentModule)) {
      return;
    }

    if (currentModule === 'CENSUS') {
      checkCensusExistsDetailed(currentDateString)
        .then(result => {
          setIsArchived(buildArchiveStatusState(result));
          const notice = getStorageLookupNotice(result, 'censo');
          if (notice?.channel === 'warning') {
            warning(notice.title, notice.message);
          }
        })
        .catch(() => setIsArchived(false));
      return;
    }

    import('@/services/backup/pdfStorageService').then(({ pdfExistsDetailed }) => {
      pdfExistsDetailed(currentDateString, selectedShift)
        .then(result => {
          setIsArchived(buildArchiveStatusState(result));
          const notice = getStorageLookupNotice(result, 'PDF');
          if (notice?.channel === 'warning') {
            warning(notice.title, notice.message);
          }
        })
        .catch(() => setIsArchived(false));
    });
  }, [currentDateString, currentModule, selectedShift, warning]);

  const handleExportPDF = useCallback(async () => {
    const outcome = await executeExportHandoffPdf({ record, selectedShift });
    const notice = presentBackupExportOutcome(outcome, {
      successTitle: 'PDF generado',
      partialTitle: 'PDF generado con observaciones',
      failedTitle: 'Error al generar PDF',
      fallbackErrorMessage: 'Error al generar el PDF. Por favor intente nuevamente.',
    });
    if (notice.channel === 'success') {
      success(notice.title, notice.message);
    } else if (notice.channel === 'warning') {
      warning(notice.title, notice.message);
    } else {
      notifyError(notice.title, notice.message);
    }
  }, [notifyError, record, selectedShift, success, warning]);

  const handleBackupExcel = useCallback(async () => {
    setIsBackingUp(true);
    try {
      const outcome = await executeBackupCensusExcel({
        selectedYear,
        selectedMonth,
        selectedDay,
        currentDateString,
        record,
      });
      const notice = presentBackupExportOutcome(outcome, {
        successTitle: 'Excel archivado',
        successMessage: `Guardado para ${currentDateString}`,
        partialTitle: 'Excel archivado con observaciones',
        failedTitle: 'Error al realizar el respaldo en la nube',
        fallbackErrorMessage: 'Error al realizar el respaldo en la nube',
      });
      if (outcome.status === 'success' || outcome.status === 'partial') {
        setIsArchived(true);
      }
      if (notice.channel === 'success') {
        success(notice.title, notice.message);
      } else if (notice.channel === 'warning') {
        warning(notice.title, notice.message);
      } else {
        notifyError(notice.title, notice.message);
      }
    } finally {
      setIsBackingUp(false);
    }
  }, [
    selectedYear,
    selectedMonth,
    selectedDay,
    record,
    currentDateString,
    success,
    warning,
    notifyError,
  ]);

  const handleBackupHandoff = useCallback(
    async (skipConfirmation = false) => {
      if (!record) return;

      const { delivers, receives } = resolveHandoffBackupStaff(record, selectedShift);

      const [year, month, day] = record.date.split('-');
      const formattedDate = `${day}-${month}-${year}`;
      const shiftLabel = selectedShift === 'day' ? 'Turno Largo' : 'Turno Noche';
      const actionLabel = isArchived ? 'Actualizar' : 'Guardar';

      if (!skipConfirmation) {
        const confirmed = await confirm({
          title: `💾 ${actionLabel} Respaldo PDF`,
          message: isArchived
            ? `Ya existe un respaldo para ${shiftLabel} del ${formattedDate}.\n\n¿Desea sobrescribirlo con los datos actuales?`
            : `¿Desea guardar esta entrega de turno como archivo PDF?\n\nFecha: ${formattedDate}\nTurno: ${shiftLabel}`,
          confirmText: actionLabel,
          cancelText: 'Cancelar',
          variant: isArchived ? 'warning' : 'info',
        });

        if (!confirmed) return;
      }

      setIsBackingUp(true);
      try {
        const outcome = await executeBackupHandoffPdf({ record, selectedShift });
        const notice = presentBackupExportOutcome(outcome, {
          successTitle: selectedShift === 'night' ? 'Respaldos guardados' : 'Respaldo PDF guardado',
          successMessage: selectedShift === 'night' ? 'PDF + CUDYR mensual' : undefined,
          partialTitle: 'Respaldo PDF guardado con observaciones',
          failedTitle: 'Error al guardar el respaldo PDF',
          fallbackErrorMessage: 'Error al guardar el respaldo PDF',
        });
        if (outcome.status === 'success' || outcome.status === 'partial') {
          setIsArchived(true);
        }
        if (notice.channel === 'success') {
          success(notice.title, notice.message);
        } else if (notice.channel === 'warning') {
          warning(notice.title, notice.message);
        } else {
          notifyError(notice.title, notice.message);
        }
      } finally {
        setIsBackingUp(false);
      }
    },
    [record, selectedShift, success, warning, notifyError, confirm, isArchived]
  );

  return {
    isArchived,
    isBackingUp,
    handleExportPDF,
    handleBackupExcel,
    handleBackupHandoff,
  };
};
