import type { BedDefinition } from '@/types/domain/beds';

export interface HandoffLogicViewState {
  isMedical: boolean;
  visibleBeds: BedDefinition[];
  hasAnyPatients: boolean;
  noteField: 'handoffNoteDayShift' | 'handoffNoteNightShift' | 'medicalHandoffNote';
  deliversList: string[];
  receivesList: string[];
  tensList: string[];
}

export const buildHandoffLogicViewState = ({
  isMedical,
  visibleBeds,
  hasAnyPatients,
  noteField,
  deliversList,
  receivesList,
  tensList,
}: HandoffLogicViewState): HandoffLogicViewState => ({
  isMedical,
  visibleBeds,
  hasAnyPatients,
  noteField,
  deliversList,
  receivesList,
  tensList,
});
