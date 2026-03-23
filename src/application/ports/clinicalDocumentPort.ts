import { ClinicalDocumentRepository } from '@/services/repositories/ClinicalDocumentRepository';
import type {
  ClinicalDocumentPdfMeta,
  ClinicalDocumentRecord,
} from '@/features/clinical-documents/public';

export interface ClinicalDocumentPort {
  listByEpisode: (episodeKey: string, hospitalId?: string) => Promise<ClinicalDocumentRecord[]>;
  listByEpisodeKeys: (
    episodeKeys: string[],
    hospitalId?: string
  ) => Promise<ClinicalDocumentRecord[]>;
  saveDraft: (
    record: ClinicalDocumentRecord,
    hospitalId?: string
  ) => Promise<ClinicalDocumentRecord>;
  createDraft: (
    record: ClinicalDocumentRecord,
    hospitalId?: string
  ) => Promise<ClinicalDocumentRecord>;
  sign: (record: ClinicalDocumentRecord, hospitalId?: string) => Promise<ClinicalDocumentRecord>;
  unsign: (record: ClinicalDocumentRecord, hospitalId?: string) => Promise<ClinicalDocumentRecord>;
  savePdfMetadata: (
    documentId: string,
    pdf: ClinicalDocumentPdfMeta,
    hospitalId?: string
  ) => Promise<void>;
  delete: (documentId: string, hospitalId?: string) => Promise<void>;
  subscribeByEpisode: (
    episodeKey: string,
    callback: (documents: ClinicalDocumentRecord[]) => void,
    hospitalId?: string
  ) => () => void;
}

export const defaultClinicalDocumentPort: ClinicalDocumentPort = {
  listByEpisode: async (episodeKey, hospitalId) =>
    ClinicalDocumentRepository.listByEpisode(episodeKey, hospitalId),
  listByEpisodeKeys: async (episodeKeys, hospitalId) =>
    ClinicalDocumentRepository.listByEpisodeKeys(episodeKeys, hospitalId),
  saveDraft: async (record, hospitalId) => ClinicalDocumentRepository.saveDraft(record, hospitalId),
  createDraft: async (record, hospitalId) =>
    ClinicalDocumentRepository.createDraft(record, hospitalId),
  sign: async (record, hospitalId) => ClinicalDocumentRepository.sign(record, hospitalId),
  unsign: async (record, hospitalId) => ClinicalDocumentRepository.unsign(record, hospitalId),
  savePdfMetadata: async (documentId, pdf, hospitalId) =>
    ClinicalDocumentRepository.savePdfMetadata(documentId, pdf, hospitalId),
  delete: async (documentId, hospitalId) =>
    ClinicalDocumentRepository.delete(documentId, hospitalId),
  subscribeByEpisode: (episodeKey, callback, hospitalId) =>
    ClinicalDocumentRepository.subscribeByEpisode(episodeKey, callback, hospitalId),
};
