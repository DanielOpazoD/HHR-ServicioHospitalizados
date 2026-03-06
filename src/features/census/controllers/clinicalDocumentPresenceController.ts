import { buildClinicalEpisodeKey } from '@/features/clinical-documents/controllers/clinicalDocumentEpisodeController';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import type { OccupiedBedRow } from '@/features/census/types/censusTableTypes';

export interface BedEpisodeBinding {
  bedId: string;
  episodeKey: string;
}

export const buildBedEpisodeBindings = (occupiedRows: OccupiedBedRow[]): BedEpisodeBinding[] =>
  occupiedRows
    .filter(row => !row.isSubRow)
    .flatMap(row => {
      const patientRut = row.data.rut?.trim();
      const admissionDate = row.data.admissionDate?.trim();
      if (!patientRut || !admissionDate) {
        return [];
      }

      return [
        {
          bedId: row.bed.id,
          episodeKey: buildClinicalEpisodeKey(patientRut, admissionDate),
        },
      ];
    });

export const buildActiveClinicalDocumentEpisodeKeys = (
  documents: ClinicalDocumentRecord[] | undefined
): Set<string> =>
  new Set(
    (documents || [])
      .filter(document => document.status !== 'archived')
      .map(document => document.episodeKey)
  );

export const buildClinicalDocumentPresenceByBed = (
  bindings: BedEpisodeBinding[],
  activeEpisodeKeys: Set<string>
): Record<string, boolean> => {
  const next: Record<string, boolean> = {};

  bindings.forEach(binding => {
    next[binding.bedId] = activeEpisodeKeys.has(binding.episodeKey);
  });

  return next;
};
