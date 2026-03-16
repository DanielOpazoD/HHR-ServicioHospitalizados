import type {
  HandoffClinicalEventActions,
  HandoffMedicalActions,
} from '@/features/handoff/components/handoffRowContracts';
import type { MedicalHandoffCapabilities } from '@/features/handoff/controllers/medicalHandoffAccessController';
import type { ClinicalEvent } from '@/types/domain/clinical';
import type { Specialty } from '@/types/domain/base';

interface BuildHandoffMedicalActionsParams {
  capabilities: MedicalHandoffCapabilities;
  onCreatePrimaryEntry: (bedId: string, isNested: boolean) => void;
  onEntryNoteChange: (bedId: string, entryId: string, value: string, isNested: boolean) => void;
  onEntrySpecialtyChange: (
    bedId: string,
    entryId: string,
    specialty: string,
    isNested: boolean
  ) => void;
  onEntryAdd: (bedId: string, isNested: boolean) => void;
  onEntryDelete: (bedId: string, entryId: string, isNested: boolean) => void;
  onContinuityConfirm: (bedId: string, entryId: string, isNested: boolean) => void;
}

interface BuildHandoffClinicalEventActionsParams {
  canEditClinicalEvents: boolean;
  onAdd: (bedId: string, event: Omit<ClinicalEvent, 'id' | 'createdAt'>) => void;
  onUpdate: (bedId: string, eventId: string, data: Partial<ClinicalEvent>) => void;
  onDelete: (bedId: string, eventId: string) => void;
}

export const resolveEffectiveSelectedMedicalSpecialty = (
  selectedMedicalSpecialty: Specialty | 'all',
  availableMedicalSpecialties: Specialty[]
): Specialty | 'all' =>
  selectedMedicalSpecialty !== 'all' &&
  !availableMedicalSpecialties.includes(selectedMedicalSpecialty)
    ? 'all'
    : selectedMedicalSpecialty;

export const buildHandoffMedicalActions = ({
  capabilities,
  onCreatePrimaryEntry,
  onEntryNoteChange,
  onEntrySpecialtyChange,
  onEntryAdd,
  onEntryDelete,
  onContinuityConfirm,
}: BuildHandoffMedicalActionsParams): HandoffMedicalActions => ({
  onCreatePrimaryEntry: capabilities.canCreatePrimaryObservationEntry
    ? onCreatePrimaryEntry
    : undefined,
  onEntryNoteChange: capabilities.canEditObservationEntries ? onEntryNoteChange : undefined,
  onEntrySpecialtyChange: capabilities.canEditObservationEntrySpecialty
    ? onEntrySpecialtyChange
    : undefined,
  onEntryAdd: capabilities.canAddObservationEntries ? onEntryAdd : undefined,
  onEntryDelete: capabilities.canDeleteObservationEntries ? onEntryDelete : undefined,
  onContinuityConfirm: capabilities.canConfirmObservationContinuity
    ? onContinuityConfirm
    : undefined,
});

export const buildHandoffClinicalEventActions = ({
  canEditClinicalEvents,
  onAdd,
  onUpdate,
  onDelete,
}: BuildHandoffClinicalEventActionsParams): HandoffClinicalEventActions => ({
  onAdd: canEditClinicalEvents ? onAdd : undefined,
  onUpdate: canEditClinicalEvents ? onUpdate : undefined,
  onDelete: canEditClinicalEvents ? onDelete : undefined,
});
