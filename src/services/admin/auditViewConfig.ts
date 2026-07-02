import { AuditSection } from '@/types/auditActionTypes';

export interface AuditSectionConfig {
  label: string;
  color: string;
  actions?: string[];
}

export const AUDIT_ITEMS_PER_PAGE = 50;
export const AUDIT_DEFAULT_FETCH_LIMIT = 500;
export const AUDIT_FETCH_LIMIT_STEP = 500;
export const AUDIT_MAX_FETCH_LIMIT = 2500;
export const AUDIT_CLINICAL_SECTIONS: AuditSection[] = [
  'ALL',
  'TIMELINE',
  'CENSUS',
  'CUDYR',
  'HANDOFF_NURSE',
  'HANDOFF_MEDICAL',
];

export const AUDIT_SYSTEM_SECTIONS: AuditSection[] = ['SESSIONS', 'EXPORT_KEYS', 'MAINTENANCE'];

export const AUDIT_SECTIONS: Record<AuditSection, AuditSectionConfig> = {
  ALL: { label: 'Todos', color: 'bg-slate-100 text-slate-600' },
  TIMELINE: {
    label: 'Timeline clínico',
    color: 'bg-violet-100 text-violet-700',
    actions: [],
  },
  SESSIONS: {
    label: 'Sesiones',
    color: 'bg-indigo-100 text-indigo-700',
    actions: ['USER_LOGIN', 'USER_LOGOUT'],
  },
  CENSUS: {
    label: 'Censo Diario',
    color: 'bg-emerald-100 text-emerald-700',
    actions: [
      'PATIENT_ADMITTED',
      'PATIENT_DISCHARGED',
      'PATIENT_TRANSFERRED',
      'PATIENT_MODIFIED',
      'PATIENT_BED_CHANGED',
      'PATIENT_DIAGNOSIS_CHANGED',
      'PATIENT_DISCHARGE_DIAGNOSIS_CHANGED',
      'PATIENT_NOTE_UPDATED',
      'PATIENT_SPECIALTY_CHANGED',
      'CLINICAL_EVENT_ADDED',
      'CLINICAL_EVENT_UPDATED',
      'CLINICAL_EVENT_DELETED',
      'PATIENT_CLEARED',
      'DAILY_RECORD_CREATED',
      'DAILY_RECORD_DELETED',
      'PREVIOUS_DAY_EDIT_CONFIRMED',
      'CONFLICT_AUTO_MERGED',
      'CONFLICT_VERSION_RESTORED',
      'BED_BLOCKED',
      'BED_UNBLOCKED',
      'EXTRA_BED_TOGGLED',
    ],
  },
  CUDYR: {
    label: 'CUDYR',
    color: 'bg-amber-100 text-amber-700',
    actions: ['CUDYR_MODIFIED', 'CUDYR_BATCH_SAVED', 'VIEW_CUDYR'],
  },
  HANDOFF_NURSE: {
    label: 'Entrega Enfermería',
    color: 'bg-purple-100 text-purple-700',
    actions: ['NURSE_HANDOFF_MODIFIED', 'VIEW_NURSING_HANDOFF', 'HANDOFF_NOVEDADES_MODIFIED'],
  },
  HANDOFF_MEDICAL: {
    label: 'Entrega Médica',
    color: 'bg-sky-100 text-sky-700',
    actions: [
      'MEDICAL_HANDOFF_MODIFIED',
      'VIEW_MEDICAL_HANDOFF',
      'HANDOFF_NOVEDADES_MODIFIED',
      'MEDICAL_HANDOFF_SIGNED',
    ],
  },
  MAINTENANCE: { label: '🛠️ Mantenimiento', color: 'bg-slate-200 text-slate-800', actions: [] },
  EXPORT_KEYS: { label: 'Claves Excel', color: 'bg-rose-100 text-rose-700', actions: [] },
};
