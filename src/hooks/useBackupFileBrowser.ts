import { useState, useMemo, useCallback } from 'react';
import { useNotification, useConfirmDialog } from '@/context/UIContext';
import { useBackupFilesQuery, BackupFolder } from '@/hooks/useBackupFilesQuery';
import { deletePdf } from '@/services/backup/pdfStorageService';
import { deleteCensusFile } from '@/services/backup/censusStorageService';
import { deleteCudyrFile } from '@/services/backup/cudyrStorageService';
import { BaseStoredFile, MONTH_NAMES } from '@/services/backup/baseStorageService';
import { StoredPdfFile } from '@/services/backup/pdfStorageService';
import { useAuth } from '@/context/AuthContext';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntime';
import { runMonthlyBackfill } from '@/services/backup/monthlyBackfillService';

export type BackupType = 'handoff' | 'census' | 'cudyr';

interface MagicBackfillProgressState {
  completed: number;
  total: number;
  currentLabel?: string;
}

export const useBackupFileBrowser = (initialBackupType: BackupType = 'handoff') => {
  const [selectedBackupType, setSelectedBackupType] = useState<BackupType>(initialBackupType);
  const [path, setPath] = useState<string[]>(() => {
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    return [currentYear, MONTH_NAMES[now.getMonth()]];
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState<BaseStoredFile | StoredPdfFile | null>(null);
  const [isMagicBackfilling, setIsMagicBackfilling] = useState(false);
  const [magicBackfillProgress, setMagicBackfillProgress] =
    useState<MagicBackfillProgressState | null>(null);

  const { success, warning, info, error: notifyError } = useNotification();
  const { confirm } = useConfirmDialog();
  const { role } = useAuth();
  const canDelete = role === 'admin';

  const {
    data: items = [],
    isLoading,
    isRefetching,
    refetch,
  } = useBackupFilesQuery(selectedBackupType, path);
  const canRunMagicBackfill = role !== 'viewer' && path.length === 2 && !isLoading;

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item => {
      if (item.type === 'folder') return (item.data as BackupFolder).name.toLowerCase().includes(q);
      const file = item.data as BaseStoredFile;
      return file.name.toLowerCase().includes(q) || (file.date && file.date.includes(q));
    });
  }, [items, searchQuery]);

  const handleFolderClick = useCallback(
    (folderData: BackupFolder) => {
      if (folderData.type === 'year') {
        setPath([folderData.name]);
      } else if (folderData.type === 'month') {
        setPath([path[0], folderData.name]);
      }
    },
    [path]
  );

  const handleBreadcrumbNavigate = useCallback(
    (index: number) => {
      if (index === -1) {
        setPath([]);
      } else {
        setPath(path.slice(0, index + 1));
      }
    },
    [path]
  );

  const handleDelete = async (file: BaseStoredFile | StoredPdfFile) => {
    const confirmed = await confirm({
      title: 'Eliminar Archivo',
      message: `¿Está seguro de eliminar "${file.name}"?\nEsta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      if (selectedBackupType === 'handoff') {
        const pdfFile = file as StoredPdfFile;
        await deletePdf(pdfFile.date, pdfFile.shiftType);
      } else if (selectedBackupType === 'census') {
        await deleteCensusFile(file.date);
      } else {
        await deleteCudyrFile(file.date);
      }
      success('Archivo eliminado');
      refetch();
    } catch (err) {
      console.error('Delete error:', err);
      notifyError('Error al eliminar archivo');
    }
  };

  const handleDownload = useCallback((file: BaseStoredFile | StoredPdfFile) => {
    if (file.downloadUrl) {
      defaultBrowserWindowRuntime.open(file.downloadUrl, '_blank');
    }
  }, []);

  const changeBackupType = useCallback((type: BackupType) => {
    setSelectedBackupType(type);
  }, []);

  const handleMagicMonthBackfill = useCallback(async () => {
    if (role === 'viewer') {
      warning('No tienes permisos para ejecutar respaldo masivo');
      return;
    }

    if (path.length !== 2) {
      warning('Selecciona un mes para ejecutar respaldo masivo');
      return;
    }

    const year = Number(path[0]);
    const monthName = path[1];
    const monthNumber = MONTH_NAMES.indexOf(monthName) + 1;

    if (!Number.isInteger(year) || monthNumber < 1) {
      notifyError('No se pudo interpretar el mes seleccionado');
      return;
    }

    const moduleLabel =
      selectedBackupType === 'handoff'
        ? 'Entregas'
        : selectedBackupType === 'census'
          ? 'Censo'
          : 'CUDYR';

    const confirmed = await confirm({
      title: `Respaldo masivo ${moduleLabel}`,
      message: `Se respaldarán todas las fechas faltantes de ${monthName} ${year} para ${moduleLabel}.\n\nEste proceso puede tardar algunos minutos.`,
      confirmText: 'Ejecutar',
      cancelText: 'Cancelar',
      variant: 'info',
    });

    if (!confirmed) return;

    setIsMagicBackfilling(true);
    setMagicBackfillProgress({ completed: 0, total: 0, currentLabel: undefined });

    try {
      const monthFiles = items
        .filter(item => item.type === 'file')
        .map(item => item.data as BaseStoredFile | StoredPdfFile);

      const result = await runMonthlyBackfill({
        backupType: selectedBackupType,
        year,
        monthNumber,
        existingFiles: monthFiles,
        onProgress: progress => setMagicBackfillProgress(progress),
      });

      await refetch();

      if (result.totalPlanned === 0) {
        const message =
          result.skippedNoRecord > 0
            ? `No hay registros clínicos para ${result.skippedNoRecord} fecha(s) del mes.`
            : 'No hay pendientes; todas las fechas con registros ya tienen respaldo.';
        info('Respaldo masivo sin pendientes', message);
        return;
      }

      const summary = [
        `Generados: ${result.created}`,
        `Fallidos: ${result.failed}`,
        `Sin registro diario: ${result.skippedNoRecord}`,
      ].join(' · ');

      if (result.failed > 0) {
        warning('Respaldo masivo completado con observaciones', summary);
      } else {
        success('Respaldo masivo completado', summary);
      }

      if (result.errors.length > 0) {
        const previewErrors = result.errors.slice(0, 3).join('\n');
        notifyError('Errores detectados durante el respaldo masivo', previewErrors);
      }
    } catch (error) {
      console.error('Magic backup error:', error);
      notifyError('Error al ejecutar respaldo masivo del mes');
    } finally {
      setIsMagicBackfilling(false);
      setMagicBackfillProgress(null);
    }
  }, [
    confirm,
    info,
    items,
    notifyError,
    path,
    refetch,
    role,
    selectedBackupType,
    success,
    warning,
  ]);

  return {
    selectedBackupType,
    path,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    previewFile,
    setPreviewFile,
    items,
    filteredItems,
    isLoading,
    isRefetching,
    canDelete,
    canRunMagicBackfill,
    isMagicBackfilling,
    magicBackfillProgress,
    refetch,
    handlers: {
      handleFolderClick,
      handleBreadcrumbNavigate,
      handleDelete,
      handleDownload,
      changeBackupType,
      handleMagicMonthBackfill,
    },
  };
};
