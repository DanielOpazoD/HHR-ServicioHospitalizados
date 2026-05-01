import { AuditAction } from '@/types/auditActionTypes';
import { getCurrentUserEmail } from './utils/auditUtils';
import { logAuditEvent } from './auditCore';

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

// Critical action: reassigning a patient to a different specialty. Never throttled.
export const logPatientSpecialtyChanged = (
  bedId: string,
  patientName: string,
  rut: string,
  field: 'specialty' | 'secondarySpecialty',
  oldSpecialty: string,
  newSpecialty: string,
  recordDate: string
): Promise<void> => {
  return logAuditEvent(
    getCurrentUserEmail(),
    'PATIENT_SPECIALTY_CHANGED',
    'patient',
    bedId,
    {
      patientName,
      bedId,
      field,
      changes: {
        [field]: { old: oldSpecialty, new: newSpecialty },
      },
    },
    rut,
    recordDate
  );
};

export const logClinicalDocumentCreated = (
  documentId: string,
  templateId: string,
  documentTitle: string,
  patientRut: string | undefined,
  recordDate?: string
): Promise<void> => {
  return logAuditEvent(
    getCurrentUserEmail(),
    'CLINICAL_DOCUMENT_CREATED',
    'clinicalDocument',
    documentId,
    { documentId, templateId, documentTitle },
    patientRut,
    recordDate
  );
};

export const logClinicalDocumentDeleted = (
  documentId: string,
  templateId: string,
  documentTitle: string,
  patientRut: string | undefined,
  recordDate?: string
): Promise<void> => {
  return logAuditEvent(
    getCurrentUserEmail(),
    'CLINICAL_DOCUMENT_DELETED',
    'clinicalDocument',
    documentId,
    { documentId, templateId, documentTitle },
    patientRut,
    recordDate
  );
};

// Throttled (15 min) to avoid flooding on continuous edits in a session.
export const logClinicalDocumentEdited = (
  documentId: string,
  templateId: string,
  documentTitle: string,
  patientRut: string | undefined,
  recordDate?: string
): Promise<void> => {
  const throttleKey = `hhr_audit_throttle_CLINICAL_DOCUMENT_EDITED_${documentId}`;
  if (typeof sessionStorage !== 'undefined') {
    const lastLogged = sessionStorage.getItem(throttleKey);
    if (lastLogged) {
      const elapsed = Date.now() - new Date(lastLogged).getTime();
      if (elapsed < 15 * 60 * 1000) return Promise.resolve();
    }
    sessionStorage.setItem(throttleKey, new Date().toISOString());
  }

  return logAuditEvent(
    getCurrentUserEmail(),
    'CLINICAL_DOCUMENT_EDITED',
    'clinicalDocument',
    documentId,
    { documentId, templateId, documentTitle },
    patientRut,
    recordDate
  );
};
