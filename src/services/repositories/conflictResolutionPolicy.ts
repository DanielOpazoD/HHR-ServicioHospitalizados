import { resolveConflictDomainContextForPath } from '@/services/repositories/conflictResolutionDomainPolicy';

const ROOT_LOCAL_PRIORITY_FIELDS = new Set([
  'handoffNovedadesDayShift',
  'handoffNovedadesNightShift',
  'medicalHandoffGlobalNote',
]);

export const CONFLICT_RESOLUTION_POLICY_VERSION = '2026-03-v3';

export interface ScalarPolicyDecision {
  value: unknown;
  winner: 'local' | 'remote';
  reason:
    | 'local_undefined_fallback'
    | 'remote_undefined_fallback'
    | 'root_local_priority'
    | 'root_remote_priority'
    | 'clinical_local_priority'
    | 'admin_remote_priority'
    | 'staffing_local_priority'
    | 'handoff_local_priority'
    | 'metadata_remote_priority'
    | 'default_local_priority'
    | 'default_remote_priority';
}

const ROOT_REMOTE_PRIORITY_FIELDS = new Set(['dateTimestamp', 'schemaVersion']);

const CLINICAL_PATIENT_FIELDS = new Set([
  'patientName',
  'rut',
  'documentType',
  'age',
  'birthDate',
  'biologicalSex',
  'insurance',
  'pathology',
  'snomedCode',
  'cie10Code',
  'cie10Description',
  'diagnosisComments',
  'specialty',
  'secondarySpecialty',
  'status',
  'medicalHandoffNote',
  'medicalHandoffAudit',
  'medicalHandoffEntries',
  'handoffNote',
  'handoffNoteDayShift',
  'handoffNoteNightShift',
  'clinicalCrib',
  'deliveryRoute',
  'deliveryDate',
]);

const ADMIN_PATIENT_FIELDS = new Set([
  'bedId',
  'bedName',
  'isBlocked',
  'blockedReason',
  'bedMode',
  'hasCompanionCrib',
  'location',
  'admissionDate',
  'admissionTime',
  'admissionOrigin',
  'admissionOriginDetails',
  'origin',
]);

export const RECORD_STRUCTURAL_FIELDS = new Set([
  'date',
  'beds',
  'discharges',
  'transfers',
  'cma',
  'nurses',
  'nursesDayShift',
  'nursesNightShift',
  'tensDayShift',
  'tensNightShift',
  'activeExtraBeds',
  'handoffDayChecklist',
  'handoffNightChecklist',
  'medicalHandoffBySpecialty',
  'medicalSignature',
  'medicalSignatureByScope',
  'medicalHandoffSentAtByScope',
  'medicalSignatureLinkTokenByScope',
  'lastUpdated',
]);

export const selectScalarByPolicy = (
  path: string,
  remote: unknown,
  local: unknown,
  preferLocalDefault: boolean
): unknown => {
  return decideScalarByPolicy(path, remote, local, preferLocalDefault).value;
};

export const decideScalarByPolicy = (
  path: string,
  remote: unknown,
  local: unknown,
  preferLocalDefault: boolean
): ScalarPolicyDecision => {
  if (local === undefined) {
    return { value: remote, winner: 'remote', reason: 'local_undefined_fallback' };
  }
  if (remote === undefined) {
    return { value: local, winner: 'local', reason: 'remote_undefined_fallback' };
  }

  if (ROOT_LOCAL_PRIORITY_FIELDS.has(path)) {
    return { value: local, winner: 'local', reason: 'root_local_priority' };
  }
  if (ROOT_REMOTE_PRIORITY_FIELDS.has(path)) {
    return { value: remote, winner: 'remote', reason: 'root_remote_priority' };
  }

  const context = resolveConflictDomainContextForPath(path);
  if (context === 'handoff') {
    return { value: local, winner: 'local', reason: 'handoff_local_priority' };
  }
  if (context === 'staffing') {
    return { value: local, winner: 'local', reason: 'staffing_local_priority' };
  }
  if (context === 'metadata') {
    return { value: remote, winner: 'remote', reason: 'metadata_remote_priority' };
  }

  const parts = path.split('.');
  if (parts[0] === 'beds' && parts.length >= 3) {
    const patientField = parts[2];
    if (CLINICAL_PATIENT_FIELDS.has(patientField)) {
      return { value: local, winner: 'local', reason: 'clinical_local_priority' };
    }
    if (ADMIN_PATIENT_FIELDS.has(patientField)) {
      return { value: remote, winner: 'remote', reason: 'admin_remote_priority' };
    }
  }

  if (preferLocalDefault) {
    return { value: local, winner: 'local', reason: 'default_local_priority' };
  }
  return { value: remote, winner: 'remote', reason: 'default_remote_priority' };
};
