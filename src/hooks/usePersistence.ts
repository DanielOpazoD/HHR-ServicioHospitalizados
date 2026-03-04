import { useCallback } from 'react';
import { useNotification } from '@/context/UIContext';
import { logDailyRecordCreated, logDailyRecordDeleted } from '@/services/admin/auditService';
import {
  getForDateWithMeta,
  getPreviousDayWithMeta,
  initializeDay,
  deleteDay,
} from '@/services/repositories/DailyRecordRepository';
import { DailyRecord } from '@/types';
import { getUserFriendlyErrorMessage } from '@/services/utils/errorService';

const shouldWarnLegacyRepair = (
  meta: {
    compatibilityIntensity: string;
    migrationRulesApplied: string[];
  } | null
): boolean =>
  Boolean(
    meta &&
    meta.compatibilityIntensity !== 'none' &&
    meta.migrationRulesApplied.some(
      rule =>
        rule === 'legacy_nulls_normalized' ||
        rule === 'salvage_patient_fallback_applied' ||
        rule === 'schema_defaults_applied'
    )
  );

interface UsePersistenceProps {
  currentDateString: string;
  markLocalChange: () => void;
  setRecord: (record: DailyRecord | null) => void;
}

/**
 * Hook to manage day lifecycle and persistence operations.
 * Extracts "Create", "Delete", and "Demo" logic from useDailyRecord.
 */
export const usePersistence = ({
  currentDateString,
  markLocalChange,
  setRecord,
}: UsePersistenceProps) => {
  const { success, warning, error: notifyError } = useNotification();

  /**
   * Creates a new daily record for the current date.
   */
  const createDay = useCallback(
    async (copyFromPrevious: boolean, specificDate?: string) => {
      let prevDate: string | undefined = undefined;
      let copySourceMeta: {
        compatibilityIntensity: string;
        migrationRulesApplied: string[];
      } | null = null;

      try {
        if (copyFromPrevious) {
          if (specificDate) {
            const source = await getForDateWithMeta(specificDate, true);
            if (!source.record) {
              warning(
                'No se encontró registro anterior',
                'No hay datos del día seleccionado para copiar.'
              );
              return;
            }
            prevDate = source.record.date;
            copySourceMeta = source;
          } else {
            const prevRecord = await getPreviousDayWithMeta(currentDateString);
            if (prevRecord.record) {
              prevDate = prevRecord.record.date;
              copySourceMeta = prevRecord;
            } else {
              warning(
                'No se encontró registro anterior',
                'No hay datos del día previo para copiar.'
              );
              return;
            }
          }
        }

        const newRecord = await initializeDay(currentDateString, prevDate);
        markLocalChange();
        setRecord(newRecord);

        const sourceMsg = prevDate ? `Copiado desde ${prevDate}` : 'Registro en blanco';
        success('Día creado', sourceMsg);
        if (shouldWarnLegacyRepair(copySourceMeta)) {
          warning(
            'Se corrigieron datos heredados',
            'La copia se realizó correctamente, pero se repararon datos antiguos incompatibles.'
          );
        }

        logDailyRecordCreated(
          currentDateString,
          copyFromPrevious ? specificDate || 'previous_day' : 'blank'
        );
      } catch (error) {
        notifyError('No se pudo crear el día', getUserFriendlyErrorMessage(error));
      }
    },
    [currentDateString, warning, success, notifyError, markLocalChange, setRecord]
  );

  /**
   * Deletes the current day's record.
   */
  const resetDay = useCallback(async () => {
    await deleteDay(currentDateString);
    setRecord(null);
    success('Registro eliminado', 'El registro del día ha sido eliminado.');

    logDailyRecordDeleted(currentDateString);
  }, [currentDateString, setRecord, success]);

  return {
    createDay,
    resetDay,
  };
};
