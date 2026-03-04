import React from 'react';
import * as ExportService from '@/services/exporters/exportService';
import { DailyRecord } from '@/types';
import { useNotification } from '@/context/UIContext';

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

  const handleExportJSON = () => {
    try {
      ExportService.exportDataJSON();
      success('Datos exportados exitosamente', 'Export JSON');
    } catch (_err) {
      error('Error al exportar datos', 'Export Error');
    }
  };

  const handleExportCSV = () => {
    try {
      ExportService.exportDataCSV(record);
      success('CSV exportado exitosamente', 'Export CSV');
    } catch (_err) {
      error('Error al exportar CSV', 'Export Error');
    }
  };

  const handleImportFile = async (file: File) => {
    if (file.name.endsWith('.json')) {
      try {
        const result = await ExportService.importDataJSONDetailed(file);
        if (result.success) {
          success(
            'Datos importados correctamente',
            `${result.importedCount} registro(s) importado(s).`
          );
          if (result.repairedCount > 0) {
            warning(
              'Se corrigieron datos heredados',
              `${result.repairedCount} registro(s) fueron reparados automáticamente durante la importación.`
            );
          }
          if (result.skippedEntries.length > 0) {
            error(
              'Algunos registros no se importaron',
              result.skippedEntries.slice(0, 5).join(', ')
            );
          }
          onRefresh();
        } else {
          error('Error al importar datos', 'Import Error');
        }
      } catch (_err) {
        error('Error al procesar archivo', 'Import Error');
      }
    } else {
      error('Por favor seleccione un archivo .json válido', 'Formato Inválido');
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
