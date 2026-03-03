import { useState, useCallback } from 'react';
import {
  executeConsolidation,
  previewConsolidation,
} from '@/services/admin/auditConsolidationService';
import { useNotification, useConfirmDialog } from '@/context/UIContext';

interface UseAuditConsolidationParams {
  onConsolidated?: () => void | Promise<void>;
}

export const useAuditConsolidation = ({ onConsolidated }: UseAuditConsolidationParams = {}) => {
  const [isConsolidating, setIsConsolidating] = useState(false);
  const { success, error, info } = useNotification();
  const { confirm } = useConfirmDialog();

  const handleConsolidate = useCallback(async () => {
    try {
      info('Analizando logs...', 'Buscando duplicados');
      const preview = await previewConsolidation(5);

      if (preview.duplicateGroups.length === 0) {
        success('No hay duplicados', 'Todos los logs están consolidados');
        return;
      }

      const confirmed = await confirm({
        title: '🗂️ Consolidar Logs Duplicados',
        message: `Se encontraron ${preview.duplicateGroups.length} grupos con duplicados.\n\nEsto eliminará ${preview.estimatedDeletions} logs redundantes y mantendrá ${preview.duplicateGroups.length} logs consolidados con todos los cambios.\n\n¿Desea continuar?`,
        confirmText: 'Consolidar',
        cancelText: 'Cancelar',
        variant: 'warning',
      });

      if (!confirmed) return;

      setIsConsolidating(true);

      const result = await executeConsolidation(5, undefined, message => {
        info(message, 'Procesando...');
      });

      if (!result.success) {
        error('Error en consolidación', result.errors.join(', '));
        return;
      }

      success(
        'Consolidación completada',
        `${result.logsConsolidated} logs actualizados, ${result.logsDeleted} duplicados eliminados`
      );

      await onConsolidated?.();
    } catch (consolidationError) {
      console.error('Consolidation failed:', consolidationError);
      error('Error', 'No se pudo consolidar los logs');
    } finally {
      setIsConsolidating(false);
    }
  }, [confirm, error, info, onConsolidated, success]);

  return {
    isConsolidating,
    handleConsolidate,
  };
};
