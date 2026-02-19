import { AuditAction } from '@/types/audit';
import { getCurrentUserEmail } from './utils/auditUtils';
import { logAuditEvent, logThrottledViewEvent, shouldExcludeFromViewAudit } from './auditCore';

interface ConflictAutoMergeAuditDetails {
  changedPaths: string[];
  policyVersion: string;
  entryCount: number;
  strategyBreakdown: Record<string, number>;
  winnerBreakdown: Record<string, number>;
  samplePaths: string[];
}

const shouldLogThrottledAction = (action: AuditAction, entityId: string): boolean => {
  const stateKey = `hhr_audit_throttle_${action}_${entityId}`;
  if (typeof sessionStorage === 'undefined') return true;

  const lastLogged = sessionStorage.getItem(stateKey);
  if (!lastLogged) return true;

  const elapsed = Date.now() - new Date(lastLogged).getTime();
  return elapsed >= 5 * 60 * 1000;
};

const markActionAsLogged = (action: AuditAction, entityId: string): void => {
  const stateKey = `hhr_audit_throttle_${action}_${entityId}`;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(stateKey, new Date().toISOString());
  }
};

const shouldLogCudyrAction = (bedId: string): boolean => {
  const stateKey = `hhr_audit_throttle_CUDYR_MODIFIED_${bedId}`;
  if (typeof sessionStorage === 'undefined') return true;
  const lastLogged = sessionStorage.getItem(stateKey);
  if (!lastLogged) return true;
  const elapsed = Date.now() - new Date(lastLogged).getTime();
  return elapsed >= 15 * 60 * 1000;
};

export const logPatientAdmission = (
  bedId: string,
  patientName: string,
  rut: string,
  pathology: string,
  recordDate: string
): Promise<void> => {
  return logAuditEvent(
    getCurrentUserEmail(),
    'PATIENT_ADMITTED',
    'patient',
    bedId,
    { patientName, bedId, pathology, rut },
    rut,
    recordDate
  );
};

export const logPatientDischarge = (
  bedId: string,
  patientName: string,
  rut: string,
  status: string,
  recordDate: string
): Promise<void> => {
  return logAuditEvent(
    getCurrentUserEmail(),
    'PATIENT_DISCHARGED',
    'discharge',
    bedId,
    { patientName, status, bedId, rut },
    rut,
    recordDate
  );
};

export const logPatientTransfer = (
  bedId: string,
  patientName: string,
  rut: string,
  destination: string,
  recordDate: string
): Promise<void> => {
  return logAuditEvent(
    getCurrentUserEmail(),
    'PATIENT_TRANSFERRED',
    'transfer',
    bedId,
    { patientName, destination, bedId, rut },
    rut,
    recordDate
  );
};

export const logPatientCleared = (
  bedId: string,
  patientName: string,
  rut: string,
  recordDate: string
): Promise<void> => {
  return logAuditEvent(
    getCurrentUserEmail(),
    'PATIENT_CLEARED',
    'patient',
    bedId,
    { patientName, bedId },
    rut,
    recordDate
  );
};

export const logDailyRecordDeleted = (date: string): Promise<void> => {
  return logAuditEvent(
    getCurrentUserEmail(),
    'DAILY_RECORD_DELETED',
    'dailyRecord',
    date,
    { date },
    undefined,
    date
  );
};

export const logDailyRecordCreated = (date: string, copiedFrom?: string): Promise<void> => {
  return logAuditEvent(
    getCurrentUserEmail(),
    'DAILY_RECORD_CREATED',
    'dailyRecord',
    date,
    { date, copiedFrom },
    undefined,
    date
  );
};

export const logConflictAutoMerged = (
  recordDate: string,
  details: ConflictAutoMergeAuditDetails
): Promise<void> => {
  return logAuditEvent(
    getCurrentUserEmail(),
    'CONFLICT_AUTO_MERGED',
    'dailyRecord',
    recordDate,
    details as unknown as Record<string, unknown>,
    undefined,
    recordDate
  );
};

export const logPatientView = (
  bedId: string,
  patientName: string,
  rut: string,
  recordDate: string
): Promise<void> => {
  if (shouldExcludeFromViewAudit()) {
    return Promise.resolve();
  }

  return logThrottledViewEvent('VIEW_PATIENT', bedId, { patientName, bedId, rut }, recordDate);
};

export const logNurseHandoffModified = (
  bedId: string,
  patientName: string,
  rut: string,
  shift: string,
  note: string,
  oldNote: string,
  recordDate: string
): Promise<void> => {
  if (!shouldLogThrottledAction('NURSE_HANDOFF_MODIFIED', bedId)) {
    return Promise.resolve();
  }
  markActionAsLogged('NURSE_HANDOFF_MODIFIED', bedId);

  return logAuditEvent(
    getCurrentUserEmail(),
    'NURSE_HANDOFF_MODIFIED',
    'patient',
    bedId,
    {
      patientName,
      bedId,
      rut,
      shift,
      note,
      changes: {
        note: { old: oldNote, new: note },
      },
    },
    rut,
    recordDate
  );
};

export const logMedicalHandoffModified = (
  bedId: string,
  patientName: string,
  rut: string,
  note: string,
  oldNote: string,
  recordDate: string
): Promise<void> => {
  if (!shouldLogThrottledAction('MEDICAL_HANDOFF_MODIFIED', bedId)) {
    return Promise.resolve();
  }
  markActionAsLogged('MEDICAL_HANDOFF_MODIFIED', bedId);

  return logAuditEvent(
    getCurrentUserEmail(),
    'MEDICAL_HANDOFF_MODIFIED',
    'patient',
    bedId,
    {
      patientName,
      bedId,
      rut,
      note,
      changes: {
        note: { old: oldNote, new: note },
      },
    },
    rut,
    recordDate
  );
};

export const logHandoffNovedadesModified = (
  shift: string,
  content: string,
  oldContent: string,
  recordDate: string
): Promise<void> => {
  return logAuditEvent(
    getCurrentUserEmail(),
    'HANDOFF_NOVEDADES_MODIFIED',
    'dailyRecord',
    recordDate,
    {
      shift,
      content,
      changes: {
        novedades: { old: oldContent, new: content },
      },
    },
    undefined,
    recordDate
  );
};

export const logCudyrModified = (
  bedId: string,
  patientName: string,
  rut: string,
  field: string,
  value: number,
  oldValue: number,
  recordDate: string
): Promise<void> => {
  if (!shouldLogCudyrAction(bedId)) {
    return Promise.resolve();
  }
  markActionAsLogged('CUDYR_MODIFIED', bedId);

  return logAuditEvent(
    getCurrentUserEmail(),
    'CUDYR_MODIFIED',
    'patient',
    bedId,
    {
      patientName,
      bedId,
      lastField: field,
      lastValue: value,
      changes: {
        [field]: { old: oldValue, new: value },
      },
    },
    rut,
    recordDate
  );
};
