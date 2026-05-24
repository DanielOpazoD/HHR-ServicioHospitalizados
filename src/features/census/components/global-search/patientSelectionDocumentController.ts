import { buildClinicalEpisodeKey } from '@/application/patient-flow/clinicalEpisode';
import type { ClinicalDocSummary } from '@/features/census/components/global-search/globalSearchContracts';

export interface ParsedCompositeEpisodeKey {
  rut: string;
  admissionDate: string;
  admissionTime?: string;
}

export const parseCompositeEpisodeKey = (key: string): ParsedCompositeEpisodeKey | null => {
  const [rut, admissionDate, admissionTime] = key.split('__');
  if (!rut || !admissionDate) return null;
  return { rut, admissionDate, admissionTime };
};

const shiftIsoDate = (isoDate: string, deltaDays: number): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
};

export const buildClinicalDocumentEpisodeKeyCandidates = ({
  rut,
  admissionDate,
  admissionTime,
}: ParsedCompositeEpisodeKey): string[] => {
  const rutWithoutDots = rut.replace(/\./g, '');
  const admissionDates = [
    admissionDate,
    shiftIsoDate(admissionDate, 1),
    shiftIsoDate(admissionDate, -1),
  ].filter((date): date is string => Boolean(date));

  return [
    ...new Set(
      admissionDates.flatMap(date => [
        buildClinicalEpisodeKey(rut, date, admissionTime),
        buildClinicalEpisodeKey(rutWithoutDots, date, admissionTime),
        buildClinicalEpisodeKey(rut, date),
        buildClinicalEpisodeKey(rutWithoutDots, date),
      ])
    ),
  ];
};

interface ClinicalDocumentSummarySource {
  id?: string;
  episodeKey?: string;
  documentType?: string;
  status?: string;
  audit?: {
    createdAt?: string;
    createdBy?: {
      displayName?: string;
    };
    updatedAt?: string;
  };
}

export const summarizeClinicalDocuments = (
  documents: ClinicalDocumentSummarySource[],
  fallbackEpisodeKey: string
): ClinicalDocSummary[] =>
  documents.map(document => ({
    id: document.id || '',
    episodeKey: document.episodeKey || fallbackEpisodeKey,
    documentType: document.documentType || '',
    status: document.status || '',
    createdAt: document.audit?.createdAt || '',
    createdBy: document.audit?.createdBy?.displayName || '',
    updatedAt: document.audit?.updatedAt || '',
  }));
