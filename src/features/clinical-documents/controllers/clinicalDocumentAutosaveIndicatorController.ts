/**
 * Clinical Document Autosave Indicator Controller
 *
 * Pure logic that resolves the visual state of the autosave indicator
 * based on saving status and last-saved timestamp.
 */

export type AutosaveIndicatorPhase = 'idle' | 'dirty' | 'saving' | 'saved';

export interface AutosaveIndicatorState {
  phase: AutosaveIndicatorPhase;
  /** Formatted time string for the "Guardado" state (e.g., "19:17") */
  savedAtLabel: string | null;
}

/**
 * Resolves the autosave indicator visual state.
 *
 * @param isSaving - Whether a save operation is in flight
 * @param isDirty - Whether the draft differs from the persisted base
 * @param lastSavedAt - ISO timestamp of the last successful save
 */
export const resolveAutosaveIndicatorState = (
  isSaving: boolean,
  isDirty: boolean,
  lastSavedAt: string | undefined
): AutosaveIndicatorState => {
  if (isSaving) {
    return { phase: 'saving', savedAtLabel: null };
  }

  if (isDirty) {
    return { phase: 'dirty', savedAtLabel: null };
  }

  if (lastSavedAt) {
    const time = formatSavedAtTime(lastSavedAt);
    return { phase: 'saved', savedAtLabel: time };
  }

  return { phase: 'idle', savedAtLabel: null };
};

/** Extracts HH:MM from an ISO timestamp string. */
const formatSavedAtTime = (isoTimestamp: string): string => {
  try {
    const date = new Date(isoTimestamp);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
};
