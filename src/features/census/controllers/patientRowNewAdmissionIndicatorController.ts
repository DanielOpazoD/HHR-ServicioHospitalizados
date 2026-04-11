import { classifyPatientMovementForRecord } from '@/application/patient-flow/clinicalEpisode';

interface ResolveIsNewAdmissionForRecordParams {
  recordDate: string;
  firstSeenDate?: string;
  admissionDate?: string;
  admissionTime?: string;
}

export const resolveIsNewAdmissionForRecord = ({
  recordDate,
  firstSeenDate,
  admissionDate,
  admissionTime,
}: ResolveIsNewAdmissionForRecordParams): boolean =>
  classifyPatientMovementForRecord(recordDate, {
    firstSeenDate,
    admissionDate,
    admissionTime,
  }).isNewAdmission;
