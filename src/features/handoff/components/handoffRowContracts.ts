import type { ClinicalEvent } from '@/types/domain/clinicalEvents';

export interface HandoffMedicalActions {
  onCreatePrimaryEntry?: (bedId: string, isNested: boolean) => void;
  onEntryNoteChange?: (bedId: string, entryId: string, value: string, isNested: boolean) => void;
  onEntrySpecialtyChange?: (
    bedId: string,
    entryId: string,
    specialty: string,
    isNested: boolean
  ) => void;
  onEntryAdd?: (bedId: string, isNested: boolean) => void;
  onEntryDelete?: (bedId: string, entryId: string, isNested: boolean) => void;
  onRefreshAsCurrent?: (bedId: string, entryId: string, isNested: boolean) => void;
}

export interface HandoffClinicalEventActions {
  onAdd?: (bedId: string, event: Omit<ClinicalEvent, 'id' | 'createdAt'>) => void;
  onUpdate?: (bedId: string, eventId: string, data: Partial<ClinicalEvent>) => void;
  onDelete?: (bedId: string, eventId: string) => void;
}
