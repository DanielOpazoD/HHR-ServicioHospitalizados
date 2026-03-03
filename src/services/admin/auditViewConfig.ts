import { AuditSection } from '@/types/audit';

export interface AuditSectionConfig {
  label: string;
  color: string;
  actions?: string[];
}

export const AUDIT_ITEMS_PER_PAGE = 50;
export const AUDIT_CLINICAL_SECTIONS: AuditSection[] = [
  'ALL',
  'TIMELINE',
  'CENSUS',
  'CUDYR',
  'HANDOFF_NURSE',
  'HANDOFF_MEDICAL',
];

export const AUDIT_SYSTEM_SECTIONS: AuditSection[] = [
  'SESSIONS',
  'EXPORT_KEYS',
  'MAINTENANCE',
  'ACCESS_CONTROL',
];

export const AUDIT_SECTIONS: Record<AuditSection, AuditSectionConfig> = {
  ALL: { label: 'Todos', color: 'bg-slate-100 text-slate-600' },
  TIMELINE: {
    label: '📅 Timeline',
    color: 'bg-violet-100 text-violet-700',
    actions: ['USER_LOGIN', 'USER_LOGOUT'],
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
      'PATIENT_CLEARED',
      'DAILY_RECORD_CREATED',
      'DAILY_RECORD_DELETED',
      'BED_BLOCKED',
      'BED_UNBLOCKED',
      'EXTRA_BED_TOGGLED',
    ],
  },
  CUDYR: {
    label: 'CUDYR',
    color: 'bg-amber-100 text-amber-700',
    actions: ['CUDYR_MODIFIED', 'VIEW_CUDYR'],
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
  ACCESS_CONTROL: { label: '🔐 Acceso Externo', color: 'bg-blue-200 text-blue-800', actions: [] },
};
