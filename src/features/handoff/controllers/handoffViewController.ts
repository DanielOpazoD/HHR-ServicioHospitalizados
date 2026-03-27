import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { BedDefinition, ShiftType, Specialty } from '@/types/domain/base';
import { buildMedicalHandoffSummary } from './medicalSpecialtyHandoffController';
import { resolveHandoffDocumentTitleLabel } from '@/shared/handoff/handoffPresentation';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import type {
  HandoffClinicalEventActions,
  HandoffMedicalActions,
} from '../components/handoffRowContracts';
import {
  resolveInitialMedicalScopeFromSearch,
  resolveInitialMedicalSpecialtyFromSearch,
} from '@/domain/handoff/view';
import { canEditMedicalHandoffForDate } from '@/shared/access/operationalAccessPolicy';
import { MessageSquare, Stethoscope } from 'lucide-react';
import type { UserRole } from '@/types/auth';
import type { AuditAction } from '@/types/audit';

interface HandoffTitleParams {
  isMedical: boolean;
  selectedShift: ShiftType;
}

export const resolveHandoffTitle = ({ isMedical, selectedShift }: HandoffTitleParams): string =>
  isMedical
    ? 'Entrega Turno Médicos'
    : `Entrega Turno Enfermería - ${selectedShift === 'day' ? 'Día' : 'Noche'} `;

export const resolveHandoffTableHeaderClass = ({
  isMedical,
  selectedShift,
}: HandoffTitleParams): string => {
  if (isMedical) {
    return 'bg-sky-100 text-sky-900 text-xs uppercase tracking-wider font-semibold border-b border-sky-100';
  }

  return selectedShift === 'day'
    ? 'bg-medical-50 text-medical-900 text-xs uppercase tracking-wider font-semibold border-b border-medical-100'
    : 'bg-slate-100 text-slate-800 text-xs uppercase tracking-wider font-semibold border-b border-slate-200';
};

interface ResolveHandoffDocumentTitleParams {
  isMedical: boolean;
  selectedShift: ShiftType;
  recordDate?: string;
}

export const resolveHandoffDocumentTitle = ({
  isMedical,
  selectedShift,
  recordDate,
}: ResolveHandoffDocumentTitleParams): string | null => {
  return resolveHandoffDocumentTitleLabel({
    isMedical,
    selectedShift,
    recordDate,
  });
};

interface ResolveHandoffNovedadesValueParams {
  isMedical: boolean;
  selectedShift: ShiftType;
  record: Pick<
    DailyRecord,
    | 'date'
    | 'medicalHandoffNovedades'
    | 'medicalHandoffBySpecialty'
    | 'handoffNovedadesDayShift'
    | 'handoffNovedadesNightShift'
  >;
}

export const resolveHandoffNovedadesValue = ({
  isMedical,
  selectedShift,
  record,
}: ResolveHandoffNovedadesValueParams): string => {
  if (isMedical) return buildMedicalHandoffSummary(record);

  if (selectedShift === 'day') return record.handoffNovedadesDayShift || '';

  return record.handoffNovedadesNightShift || record.handoffNovedadesDayShift || '';
};

export const shouldShowNightCudyrActions = ({
  isMedical,
  selectedShift,
}: HandoffTitleParams): boolean => !isMedical && selectedShift === 'night';

export const resolveInitialMedicalSpecialtyFromLocation = (
  search: string | undefined
): Specialty | 'all' => {
  if (!search) {
    return 'all';
  }

  return resolveInitialMedicalSpecialtyFromSearch(search);
};

export const resolveInitialMedicalScopeFromLocation = (
  search: string | undefined
): MedicalHandoffScope => {
  if (!search) {
    return 'all';
  }

  return resolveInitialMedicalScopeFromSearch(search);
};

interface ResolveHandoffScreenFrameParams extends HandoffTitleParams {
  role?: UserRole;
  readOnly: boolean;
  recordDate?: string;
}

export const resolveHandoffScreenFrame = ({
  isMedical,
  selectedShift,
  role,
  readOnly,
  recordDate,
}: ResolveHandoffScreenFrameParams) => {
  const effectiveReadOnly =
    readOnly ||
    (isMedical &&
      !canEditMedicalHandoffForDate({
        role,
        readOnly,
        recordDate,
      }));

  return {
    title: resolveHandoffTitle({ isMedical, selectedShift }),
    tableHeaderClass: resolveHandoffTableHeaderClass({ isMedical, selectedShift }),
    documentTitle: resolveHandoffDocumentTitle({ isMedical, selectedShift, recordDate }),
    effectiveReadOnly,
    Icon: isMedical ? Stethoscope : MessageSquare,
  };
};

export const resolveHandoffAuditDescriptor = ({
  isMedical,
  selectedShift,
}: HandoffTitleParams): {
  action: AuditAction;
  details: {
    view: 'medical_handoff' | 'nursing_handoff';
    shift: ShiftType;
  };
} => ({
  action: (isMedical ? 'VIEW_MEDICAL_HANDOFF' : 'VIEW_NURSING_HANDOFF') as AuditAction,
  details: {
    view: isMedical ? 'medical_handoff' : 'nursing_handoff',
    shift: selectedShift,
  },
});

export interface HandoffHeaderBindings {
  isMedical: boolean;
  selectedShift: ShiftType;
  setSelectedShift: (shift: ShiftType) => void;
  readOnly: boolean;
  showMedicalShareActions: boolean;
  medicalSignature?: {
    doctorName: string;
    signedAt: string;
  } | null;
  medicalHandoffSentAt?: string | null;
  onSendWhatsApp: () => void;
  onShareLink: (scope: MedicalHandoffScope) => void;
  showNightCudyrAction: boolean;
}

interface BuildHandoffHeaderBindingsParams {
  isMedical: boolean;
  selectedShift: ShiftType;
  setSelectedShift: (shift: ShiftType) => void;
  readOnly: boolean;
  canShareSignatureLinks: boolean;
  medicalSignature?: { doctorName: string; signedAt: string } | null;
  medicalHandoffSentAt?: string | null;
  onSendWhatsApp: () => void;
  onShareLink: (scope: MedicalHandoffScope) => void;
}

export const buildHandoffHeaderBindings = ({
  isMedical,
  selectedShift,
  setSelectedShift,
  readOnly,
  canShareSignatureLinks,
  medicalSignature,
  medicalHandoffSentAt,
  onSendWhatsApp,
  onShareLink,
}: BuildHandoffHeaderBindingsParams): HandoffHeaderBindings => ({
  isMedical,
  selectedShift,
  setSelectedShift,
  readOnly,
  showMedicalShareActions: canShareSignatureLinks,
  medicalSignature,
  medicalHandoffSentAt,
  onSendWhatsApp,
  onShareLink,
  showNightCudyrAction: shouldShowNightCudyrActions({ isMedical, selectedShift }),
});

export interface MedicalHandoffContentBindings {
  record: DailyRecord;
  effectiveVisibleBeds: BedDefinition[];
  specialtyFilteredBeds: BedDefinition[];
  readOnly: boolean;
  role?: string;
  canCopySpecialistLink: boolean;
  scopedMedicalSignature: { doctorName: string; signedAt: string } | null;
  scopedMedicalHandoffSentAt: string | null;
  showDeliverySection: boolean;
  canEditDoctorName: boolean;
  canSignMedicalHandoff: boolean;
  updateMedicalHandoffDoctor?: (doctorName: string) => Promise<void>;
  markMedicalHandoffAsSent?: (doctorName?: string, scope?: MedicalHandoffScope) => Promise<void>;
  resetMedicalHandoffState?: () => Promise<void>;
  selectedMedicalSpecialty: Specialty | 'all';
  setSelectedMedicalSpecialty: (specialty: Specialty | 'all') => void;
  medicalSpecialties: Specialty[];
  success: (message: string, description?: string) => void;
  noteField: 'handoffNoteDayShift' | 'handoffNoteNightShift' | 'medicalHandoffNote';
  onNoteChange: (bedId: string, value: string, isNested: boolean) => void;
  medicalActions: HandoffMedicalActions;
  clinicalEventActions: HandoffClinicalEventActions;
  tableHeaderClass: string;
  shouldShowPatient: (bedId: string) => boolean;
  scopedMedicalScope: MedicalHandoffScope;
  hasAnyVisiblePatients: boolean;
}

export const buildMedicalHandoffContentBindings = (
  bindings: MedicalHandoffContentBindings
): MedicalHandoffContentBindings => bindings;

export interface NursingHandoffContentBindings {
  visibleBeds: BedDefinition[];
  record: DailyRecord;
  noteField: 'handoffNoteDayShift' | 'handoffNoteNightShift' | 'medicalHandoffNote';
  onNoteChange: (bedId: string, value: string, isNested: boolean) => void;
  medicalActions: HandoffMedicalActions;
  tableHeaderClass: string;
  readOnly: boolean;
  hasAnyPatients: boolean;
  shouldShowPatient: (bedId: string) => boolean;
  clinicalEventActions: HandoffClinicalEventActions;
  selectedShift: ShiftType;
  updateHandoffNovedades: (shift: 'day' | 'night' | 'medical', value: string) => void;
}

export const buildNursingHandoffContentBindings = (
  bindings: NursingHandoffContentBindings
): NursingHandoffContentBindings => bindings;
