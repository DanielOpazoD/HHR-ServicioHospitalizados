import type { DailyRecord } from '@/types';
import type { SyncStatus } from '@/hooks/useDailyRecordTypes';
import { resolveDailyRecordSyncStatus } from '@/hooks/controllers/dailyRecordSyncStatusController';

interface MutationLike {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
}

interface PreviousDayReader {
  getPreviousDay: (date: string) => Promise<DailyRecord | null>;
}

interface WarningNotifier {
  (title: string, message: string): void;
}

export const resolveMutationSyncStatus = (mutations: MutationLike[]): SyncStatus =>
  resolveDailyRecordSyncStatus(mutations);

export const resolveCreateDaySourceDate = async (
  dailyRecord: PreviousDayReader,
  currentDateString: string,
  copyFromPrevious: boolean,
  specificDate: string | undefined,
  warning: WarningNotifier
) => {
  if (!copyFromPrevious) {
    return undefined;
  }

  if (specificDate) {
    return specificDate;
  }

  const previousRecord = await dailyRecord.getPreviousDay(currentDateString);
  if (!previousRecord) {
    warning('No se encontró registro anterior', 'No hay datos del día previo para copiar.');
    return null;
  }

  return previousRecord.date;
};

export const buildCreateDaySuccessMessage = (sourceDate?: string) =>
  sourceDate ? `Copiado desde ${sourceDate}` : 'Registro en blanco';
