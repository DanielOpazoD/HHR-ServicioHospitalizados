import type { DailyRecordBedAuditState } from '@/application/shared/dailyRecordBedContracts';
import type { PatientData } from '@/hooks/contracts/patientHookContracts';
import type { DailyRecordContextType } from '@/context/dailyRecordContextContracts';

interface CopyPatientParams {
  record: DailyRecordBedAuditState | null;
  bedId: string;
  targetDate: string;
  targetBedId?: string;
}

interface DailyRecordContextDependencies extends Omit<
  DailyRecordContextType,
  'copyPatientToDate' | 'record'
> {
  record: DailyRecordContextType['record'];
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
