/**
 * Clinical Document Presence Controller
 *
 * Pure logic that maps clinical document records to per-bed presence
 * indicators. Used by the census table to show which patients have
 * active documents and to display document count badges in the
 * orbital quick-action launcher.
 *
 * Data flow:
 *   unifiedRows → buildBedEpisodeBindings → episodeKeys
 *   Firestore query (by episodeKeys) → ClinicalDocumentPresenceRecord[]
 *   records → buildClinicalDocumentPresenceByBed (boolean per bed)
 *   records → buildClinicalDocumentPresenceInfoByBed (counts per bed)
 */

import { buildPatientPresenceSnapshot } from '@/application/patient-flow/clinicalEpisode';
import type { UnifiedBedRow } from '@/features/census/types/censusTableTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Lightweight projection of a clinical document for presence checks. */
type ClinicalDocumentPresenceRecord = {
  status: string;
  episodeKey: string;
};

/** Maps a bed to its patient's clinical episode key. */
export interface BedEpisodeBinding {
  bedId: string;
  episodeKey: string;
}

/** Per-bed document presence with counts for badge display. */
export interface ClinicalDocumentPresenceInfo {
  /** Whether the patient has at least one active (non-archived) document. */
  present: boolean;
  /** Total number of active (non-archived) documents. */
  totalCount: number;
  /** Number of documents still in draft status. */
  draftCount: number;
}

// ---------------------------------------------------------------------------
// Bed → Episode bindings
// ---------------------------------------------------------------------------

/**
 * Extracts bed-to-episode-key bindings from occupied census rows.
 * Sub-rows (clinical cribs) are excluded since they share the
 * parent bed's episode.
 */
export const buildBedEpisodeBindings = (unifiedRows: UnifiedBedRow[]): BedEpisodeBinding[] =>
  unifiedRows
    .filter(
      (row): row is Extract<UnifiedBedRow, { kind: 'occupied' }> =>
        row.kind === 'occupied' && !row.isSubRow
    )
    .flatMap(row => {
      const snapshot = buildPatientPresenceSnapshot(row.data, row.bed.id);
      if (!snapshot) {
        return [];
      }

      return [{ bedId: snapshot.bedId, episodeKey: snapshot.episodeKey }];
    });

// ---------------------------------------------------------------------------
// Active episode keys (boolean presence)
// ---------------------------------------------------------------------------

/**
 * Returns the set of episode keys that have at least one active
 * (non-archived) clinical document.
 */
export const buildActiveClinicalDocumentEpisodeKeys = (
  records: ClinicalDocumentPresenceRecord[] | undefined
): Set<string> =>
  new Set(
    (records || []).filter(record => record.status !== 'archived').map(record => record.episodeKey)
  );

/**
 * Maps each bed to a boolean indicating whether its patient has
 * at least one active clinical document.
 */
export const buildClinicalDocumentPresenceByBed = (
  bindings: BedEpisodeBinding[],
  activeEpisodeKeys: Set<string>
): Record<string, boolean> => {
  const result: Record<string, boolean> = {};
  bindings.forEach(b => {
    result[b.bedId] = activeEpisodeKeys.has(b.episodeKey);
  });
  return result;
};

// ---------------------------------------------------------------------------
// Document counts (badge display)
// ---------------------------------------------------------------------------

/** Aggregates active document counts grouped by episode key. */
const buildDocumentCountsByEpisodeKey = (
  records: ClinicalDocumentPresenceRecord[] | undefined
): Map<string, { total: number; drafts: number }> => {
  const counts = new Map<string, { total: number; drafts: number }>();

  (records || [])
    .filter(r => r.status !== 'archived')
    .forEach(r => {
      const entry = counts.get(r.episodeKey) || { total: 0, drafts: 0 };
      entry.total++;
      if (r.status === 'draft') entry.drafts++;
      counts.set(r.episodeKey, entry);
    });

  return counts;
};

/**
 * Maps each bed to detailed document presence info including counts.
 * Used to populate badges in the orbital quick-action launcher.
 */
export const buildClinicalDocumentPresenceInfoByBed = (
  bindings: BedEpisodeBinding[],
  records: ClinicalDocumentPresenceRecord[] | undefined
): Record<string, ClinicalDocumentPresenceInfo> => {
  const counts = buildDocumentCountsByEpisodeKey(records);
  const result: Record<string, ClinicalDocumentPresenceInfo> = {};

  bindings.forEach(b => {
    const entry = counts.get(b.episodeKey);
    result[b.bedId] = {
      present: !!entry,
      totalCount: entry?.total ?? 0,
      draftCount: entry?.drafts ?? 0,
    };
  });

  return result;
};
