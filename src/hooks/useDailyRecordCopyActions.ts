import { useCallback } from 'react';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { resolveCopyPatientRequest } from '@/hooks/controllers/dailyRecordController';
import { hasCriticalLegacyRepairSignal } from '@/hooks/controllers/legacyRepairWarningController';
import { buildCopyPatientNotifications } from '@/hooks/controllers/persistenceFeedbackController';
import { logger } from '@/services/utils/loggerService';

type CopyPatientToDateResultLike = {
  sourceDate: string;
  targetDate: string;
  sourceBedId: string;
  targetBedId: string;
  outcome: 'clean' | 'repaired';
  sourceCompatibilityIntensity:
    | 'none'
    | 'normalized_only'
    | 'legacy_staff_promoted'
    | 'legacy_schema_bridge';
  sourceMigrationRulesApplied: string[];
};

interface UseDailyRecordCopyActionsOptions {
  record: DailyRecord | null;
  refresh: () => void | Promise<void>;
  dailyRecord: {
    copyPatientToDateDetailed: (
      sourceDate: string,
      sourceBedId: string,
      targetDate: string,
      targetBedId: string
    ) => Promise<CopyPatientToDateResultLike>;
  };
  warning: (title: string, message?: string) => void;
}

const dailyRecordCopyLogger = logger.child('useDailyRecordCopyActions');

export const useDailyRecordCopyActions = ({
  record,
  refresh,
  dailyRecord,
  warning,
}: UseDailyRecordCopyActionsOptions) =>
  useCallback(
    async (bedId: string, targetDate: string, targetBedId?: string) => {
      const copyRequest = resolveCopyPatientRequest({
        record,
        bedId,
        targetDate,
        targetBedId,
      });
      if (!copyRequest) return;

      try {
        const copyResult = await dailyRecord.copyPatientToDateDetailed(
          copyRequest.sourceDate,
          copyRequest.sourceBedId,
          copyRequest.targetDate,
          copyRequest.targetBedId
        );
        const notifications = buildCopyPatientNotifications({
          outcome: copyResult.outcome,
          hasCriticalLegacyRepair: hasCriticalLegacyRepairSignal(copyResult),
        });
        for (const notification of notifications) {
          warning(notification.title, notification.message);
        }
        await refresh();
      } catch (error) {
        dailyRecordCopyLogger.error('Failed to copy patient to date', error);
        throw error;
      }
    },
    [dailyRecord, record, refresh, warning]
  );
