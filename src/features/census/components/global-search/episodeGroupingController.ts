/**
 * Episode Grouping Controller
 *
 * Pure business logic that groups sequential hospitalization events
 * (Ingreso, Egreso, Traslado, Fallecimiento) into unified episode blocks.
 *
 * Extracted from the view layer so it can be tested independently
 * without rendering React components.
 */

import type { HospitalizationEvent } from '@/types/domain/patientMaster';
import type { GroupedEpisode } from '@/features/census/components/global-search/globalSearchContracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const calculateDaysBetween = (start: string, end: string): number => {
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  return Math.max(Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)), 0);
};

const buildOpenEpisode = (
  admission: HospitalizationEvent,
  daysOfStay: number | null
): GroupedEpisode => ({
  id: admission.id,
  admission,
  discharge: null,
  diagnosis: admission.diagnosis || '',
  bedName: admission.bedName || '',
  daysOfStay,
});

const buildClosedEpisode = (
  admission: HospitalizationEvent,
  discharge: HospitalizationEvent
): GroupedEpisode => ({
  id: admission.id,
  admission,
  discharge,
  diagnosis: admission.diagnosis || discharge.diagnosis || '',
  bedName: admission.bedName || discharge.bedName || '',
  daysOfStay: calculateDaysBetween(admission.date, discharge.date),
});

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Groups sequential hospitalization events into unified episode blocks.
 *
 * Each block starts with an `Ingreso` and ends with the next closing event
 * (`Egreso`, `Traslado`, or `Fallecimiento`). If no closing event exists,
 * the patient is assumed to be currently admitted.
 *
 * @param events - Unsorted array of hospitalization events
 * @returns Episodes ordered most-recent-first
 */
export const groupEpisodesAsBlocks = (events: HospitalizationEvent[]): GroupedEpisode[] => {
  const sorted = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const grouped: GroupedEpisode[] = [];
  let currentAdmission: HospitalizationEvent | null = null;

  for (const event of sorted) {
    if (event.type === 'Ingreso') {
      // Close any unclosed admission as an open episode before starting a new one
      if (currentAdmission) {
        grouped.push(buildOpenEpisode(currentAdmission, null));
      }
      currentAdmission = event;
    } else if (currentAdmission) {
      // Closing event pairs with the current admission
      grouped.push(buildClosedEpisode(currentAdmission, event));
      currentAdmission = null;
    } else {
      // Orphan closing event without a matching admission
      grouped.push(buildOpenEpisode(event, null));
    }
  }

  // Currently admitted patient (open admission without discharge)
  if (currentAdmission) {
    const today = new Date().toISOString().slice(0, 10);
    grouped.push(
      buildOpenEpisode(currentAdmission, calculateDaysBetween(currentAdmission.date, today))
    );
  }

  return grouped.reverse();
};
