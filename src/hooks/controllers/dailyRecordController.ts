import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import type { DailyRecordContextType } from '@/hooks/useDailyRecordTypes';

interface CopyPatientParams {
  record: DailyRecord | null;
  bedId: string;
  targetDate: string;
  targetBedId?: string;
}

interface DailyRecordContextDependencies extends Omit<
  DailyRecordContextType,
  'copyPatientToDate' | 'record'
> {
  record: DailyRecord | null;
  copyPatientToDate: DailyRecordContextType['copyPatientToDate'];
}

export const resolveCopyPatientRequest = ({
  record,
  bedId,
  targetDate,
  targetBedId,
}: CopyPatientParams) => {
  if (!record) {
    return null;
  }

  const sourcePatient = record.beds[bedId] as PatientData | undefined;
  if (!sourcePatient?.patientName) {
    return null;
  }

  return {
    sourceDate: record.date,
    sourceBedId: bedId,
    targetDate,
    targetBedId: targetBedId || bedId,
  };
};

export const buildDailyRecordContextValue = ({
  record,
  copyPatientToDate,
  ...rest
}: DailyRecordContextDependencies): DailyRecordContextType => ({
  record,
  copyPatientToDate,
  ...rest,
});
