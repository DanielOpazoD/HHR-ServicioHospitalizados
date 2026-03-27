import type { MedicalHandoffEntry, PatientData } from '@/domain/handoff/patientContracts';
import {
  formatMedicalHandoffActorLabel,
  formatMedicalHandoffTimestamp,
  getDisplayMedicalHandoffEntries,
  getPatientMedicalHandoffEntries,
} from './patientEntries';

export interface MedicalHandoffValidityViewModel {
  statusLabel: string;
  canRefreshAsCurrent: boolean;
  isActiveToday: boolean;
  isMuted: boolean;
}

export interface MedicalEntryMetadataViewModel {
  primaryLabel: string;
  printLabel: string;
  detailLines: string[];
  showInfoButton: boolean;
}

export const resolveMedicalEntryInlineMeta = (entry: MedicalHandoffEntry): string => {
  const actor = formatMedicalHandoffActorLabel(
    entry.originalNoteBy?.displayName ||
      entry.originalNoteBy?.email ||
      entry.updatedBy?.displayName ||
      entry.updatedBy?.email
  );
  const timestamp = formatMedicalHandoffTimestamp(entry.originalNoteAt || entry.updatedAt);
  return [actor, timestamp].filter(Boolean).join(' · ');
};

const resolveFormattedActorAndTimestamp = (
  actor: MedicalHandoffEntry['updatedBy'] | undefined,
  timestamp: string | undefined
): string =>
  [
    formatMedicalHandoffActorLabel(actor?.displayName || actor?.email),
    formatMedicalHandoffTimestamp(timestamp),
  ]
    .filter(Boolean)
    .join(' · ');

const areSameAuditActors = (
  left: MedicalHandoffEntry['updatedBy'] | undefined,
  right: MedicalHandoffEntry['updatedBy'] | undefined
): boolean => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.uid === right.uid || left.email === right.email;
};

export const resolveMedicalHandoffValidityViewModel = (
  entry: MedicalHandoffEntry,
  reportDate: string
): MedicalHandoffValidityViewModel => {
  const wasUpdatedToday = Boolean(entry.updatedAt) && entry.updatedAt?.slice(0, 10) === reportDate;

  return {
    statusLabel: wasUpdatedToday ? 'Nota actual: actualizada hoy' : 'Nota actual: pendiente hoy',
    canRefreshAsCurrent: Boolean(entry.note.trim()),
    isActiveToday: wasUpdatedToday,
    isMuted: !wasUpdatedToday,
  };
};

export const resolveMedicalEntryMetadataViewModel = (
  entry: MedicalHandoffEntry,
  reportDate: string
): MedicalEntryMetadataViewModel => {
  const originalActor = entry.originalNoteBy || entry.updatedBy;
  const originalAt = entry.originalNoteAt || entry.updatedAt;
  const currentActor =
    entry.currentStatusDate === reportDate
      ? entry.currentStatusBy || entry.updatedBy
      : entry.updatedAt?.slice(0, 10) === reportDate
        ? entry.updatedBy
        : undefined;
  const currentAt =
    entry.currentStatusDate === reportDate
      ? entry.currentStatusAt || entry.updatedAt
      : entry.updatedAt?.slice(0, 10) === reportDate
        ? entry.updatedAt
        : undefined;

  const originalLabel = resolveFormattedActorAndTimestamp(originalActor, originalAt);
  const currentLabel = resolveFormattedActorAndTimestamp(currentActor, currentAt);
  const hasDistinctCurrentEvent =
    Boolean(currentLabel) &&
    Boolean(originalLabel) &&
    (!areSameAuditActors(originalActor, currentActor) || originalAt !== currentAt);

  if (!hasDistinctCurrentEvent) {
    const primaryLabel = originalLabel || currentLabel;
    return {
      primaryLabel,
      printLabel: primaryLabel,
      detailLines: [],
      showInfoButton: false,
    };
  }

  return {
    primaryLabel: `Nota base: ${originalLabel}`,
    printLabel: `Nota base: ${originalLabel} | Vigente por: ${currentLabel}`,
    detailLines: [`Nota original: ${originalLabel}`, `Marcada como actual por: ${currentLabel}`],
    showInfoButton: true,
  };
};

export const resolveMedicalObservationEntries = ({
  patient,
  isFieldReadOnly,
  hasCreatePrimaryEntryAction,
}: {
  patient: PatientData;
  isFieldReadOnly: boolean;
  hasCreatePrimaryEntryAction: boolean;
}): MedicalHandoffEntry[] => {
  const persistedEntries = getPatientMedicalHandoffEntries(patient);
  if (persistedEntries.length > 0) {
    return persistedEntries;
  }

  if (!isFieldReadOnly && !hasCreatePrimaryEntryAction) {
    return getDisplayMedicalHandoffEntries(patient, true);
  }

  return [];
};
