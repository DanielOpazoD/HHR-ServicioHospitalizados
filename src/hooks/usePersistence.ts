import { useCallback } from 'react';
import { useNotification } from '@/context/UIContext';
import { useRepositories } from '@/services/RepositoryContext';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { getUserFriendlyErrorMessage } from '@/services/utils/errorService';
import { hasCriticalLegacyRepairSignal } from '@/hooks/controllers/legacyRepairWarningController';
import { buildCreateDayNotifications } from '@/hooks/controllers/persistenceFeedbackController';
import { executeInitializeDailyRecord } from '@/application/daily-record/initializeDailyRecordUseCase';
import { useAuditContext } from '@/context/AuditContext';
import {
  buildCopyUnlockDescription,
  resolveCreateDayCopyAvailability,
} from '@/hooks/controllers/createDayCopyAvailabilityController';
import {
  defaultDailyRecordReadPort,
  defaultDailyRecordWritePort,
} from '@/application/ports/dailyRecordPort';
import {
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';

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
  const { dailyRecord } = useRepositories();
  const { logDailyRecordCreated, logDailyRecordDeleted } = useAuditContext();

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
          const copyAvailability = resolveCreateDayCopyAvailability(currentDateString, new Date());
          if (copyAvailability.isCopyLocked) {
            recordOperationalTelemetry({
              category: 'create_day',
              status: 'degraded',
              operation: 'copy_day_locked_by_schedule',
              date: currentDateString,
              issues: ['La copia del día previo aún no está habilitada por horario.'],
              context: { targetDate: currentDateString },
            });
            warning(
              'Copia con observaciones',
              `La copia del día previo aún no está disponible. ${buildCopyUnlockDescription(currentDateString, new Date())}`
            );
            return;
          }
        }

        if (copyFromPrevious) {
          if (specificDate) {
            const source = await defaultDailyRecordReadPort.getForDateWithMeta(specificDate, true);
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
            const prevRecord =
              await defaultDailyRecordReadPort.getPreviousDayWithMeta(currentDateString);
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

        const initOutcome = await executeInitializeDailyRecord({
          date: currentDateString,
          copyFromDate: prevDate,
          repository: dailyRecord,
        });
        recordOperationalOutcome('create_day', 'initialize_daily_record', initOutcome, {
          date: currentDateString,
          context: { copyFromPrevious, sourceDate: prevDate || null },
          allowSuccess: true,
        });
        const initResult = initOutcome.data.initialization;
        const newRecord = initOutcome.data.record;
        if (!initResult || !newRecord) {
          throw new Error(initOutcome.issues[0]?.message || 'No se pudo inicializar el día');
        }
        markLocalChange();
        setRecord(newRecord);

        const notifications = buildCreateDayNotifications({
          sourceDate: prevDate,
          outcome: initResult.outcome,
          hasCriticalLegacyRepair:
            hasCriticalLegacyRepairSignal(copySourceMeta) ||
            hasCriticalLegacyRepairSignal(initResult),
        });
        for (const notification of notifications) {
          if (notification.channel === 'success') {
            success(notification.title, notification.message);
          } else {
            warning(notification.title, notification.message);
          }
        }

        logDailyRecordCreated(
          currentDateString,
          copyFromPrevious ? specificDate || 'previous_day' : 'blank'
        );
      } catch (error) {
        recordOperationalTelemetry({
          category: 'create_day',
          status: 'failed',
          operation: 'initialize_daily_record',
          date: currentDateString,
          issues: [getUserFriendlyErrorMessage(error)],
          context: { copyFromPrevious, sourceDate: prevDate || null },
        });
        notifyError('No se pudo crear el día', getUserFriendlyErrorMessage(error));
      }
    },
    [
      currentDateString,
      warning,
      success,
      notifyError,
      markLocalChange,
      setRecord,
      dailyRecord,
      logDailyRecordCreated,
    ]
  );

  /**
   * Deletes the current day's record.
   */
  const resetDay = useCallback(async () => {
    await defaultDailyRecordWritePort.delete(currentDateString);
    recordOperationalTelemetry(
      {
        category: 'create_day',
        status: 'success',
        operation: 'delete_daily_record',
        date: currentDateString,
      },
      { allowSuccess: true }
    );
    setRecord(null);
    success('Registro eliminado', 'El registro del día ha sido eliminado.');

    logDailyRecordDeleted(currentDateString);
  }, [currentDateString, setRecord, success, logDailyRecordDeleted]);

  return {
    createDay,
    resetDay,
  };
};
