import { isNewAdmissionForClinicalDay } from '@/utils/dateUtils';

interface ResolveIsNewAdmissionForRecordParams {
  recordDate: string;
  admissionDate?: string;
  admissionTime?: string;
}

export const resolveIsNewAdmissionForRecord = ({
  recordDate,
  admissionDate,
  admissionTime,
}: ResolveIsNewAdmissionForRecordParams): boolean =>
  isNewAdmissionForClinicalDay(recordDate, admissionDate, admissionTime);
