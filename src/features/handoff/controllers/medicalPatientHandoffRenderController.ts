import type { MedicalHandoffEntry } from '@/types';
import {
  formatMedicalHandoffActorLabel,
  formatMedicalHandoffTimestamp,
} from './medicalPatientHandoffController';

export interface MedicalHandoffValidityViewModel {
  statusLabel: string;
  tooltipLabel: string;
  canConfirm: boolean;
  isActiveToday: boolean;
  isMuted: boolean;
}

export const resolveMedicalEntryInlineMeta = (entry: MedicalHandoffEntry): string => {
  const actor = formatMedicalHandoffActorLabel(
    entry.updatedBy?.displayName || entry.updatedBy?.email
  );
  const timestamp = formatMedicalHandoffTimestamp(entry.updatedAt);
  return [actor, timestamp].filter(Boolean).join(' · ');
};

export const resolveMedicalHandoffValidityViewModel = (
  entry: MedicalHandoffEntry,
  reportDate: string
): MedicalHandoffValidityViewModel => {
  const wasUpdatedToday = Boolean(entry.updatedAt) && entry.updatedAt?.slice(0, 10) === reportDate;
  const statusForToday =
    entry.currentStatusDate === reportDate
      ? entry.currentStatus
      : wasUpdatedToday
        ? 'updated_by_specialist'
        : undefined;
  const isConfirmedCurrent = statusForToday === 'confirmed_current';
  const actorLabel = isConfirmedCurrent
    ? entry.currentStatusBy?.displayName || entry.currentStatusBy?.email
    : entry.updatedBy?.displayName || entry.updatedBy?.email;
  const timestamp = isConfirmedCurrent
    ? formatMedicalHandoffTimestamp(entry.currentStatusAt)
    : formatMedicalHandoffTimestamp(entry.updatedAt);

  return {
    statusLabel: !statusForToday
      ? 'Condición actual: pendiente hoy'
      : statusForToday === 'updated_by_specialist'
        ? 'Condición actual: actualizada hoy'
        : 'Condición actual: vigente, sin cambios',
    tooltipLabel: [actorLabel, timestamp].filter(Boolean).join(' · '),
    canConfirm: Boolean(entry.note.trim()),
    isActiveToday:
      statusForToday === 'confirmed_current' || statusForToday === 'updated_by_specialist',
    isMuted: !statusForToday,
  };
};
