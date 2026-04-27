import { firestoreDb } from '@/services/storage/firestore';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import type {
  ClinicalDocumentPdfMeta,
  ClinicalDocumentRecord,
} from '@/domain/clinical-documents/entities';
import {
  buildClinicalDocumentIntegrityHash,
  buildClinicalDocumentRenderedText,
} from '@/domain/clinical-documents/rendering';
import {
  hydrateLegacyClinicalDocument,
  normalizeClinicalDocumentForPersistence,
} from '@/domain/clinical-documents/compatibility';
import {
  formatClinicalDocumentContractIssues,
  parseClinicalDocumentRecord,
  safeParseClinicalDocumentRecord,
} from '@/domain/clinical-documents/runtimeContracts';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryRecorder';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';

const getClinicalDocumentsCollectionPath = (hospitalId: string = getActiveHospitalId()): string =>
  `hospitals/${hospitalId}/clinicalDocuments`;

const EPISODE_KEY_QUERY_CHUNK_SIZE = 10;

const sortDocuments = (documents: ClinicalDocumentRecord[]): ClinicalDocumentRecord[] =>
  [...documents].sort((left, right) => right.audit.updatedAt.localeCompare(left.audit.updatedAt));

const chunkArray = <T>(values: T[], size: number): T[][] => {
  if (size <= 0) return [values];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const normalizeEpisodeKeys = (episodeKeys: string[]): string[] =>
  Array.from(
    new Set(
      episodeKeys.map(episodeKey => episodeKey.trim()).filter(episodeKey => episodeKey.length > 0)
    )
  );

const sanitizeForFirestore = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map(item => sanitizeForFirestore(item))
      .filter(item => item !== undefined) as unknown as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => [key, sanitizeForFirestore(nested)]);
    return Object.fromEntries(entries) as T;
  }

  return value;
};

const enrichRecord = (record: ClinicalDocumentRecord): ClinicalDocumentRecord => {
  const hydrated = parseClinicalDocumentRecord(normalizeClinicalDocumentForPersistence(record));
  const renderedText = buildClinicalDocumentRenderedText(hydrated);
  return {
    ...hydrated,
    renderedText,
    integrityHash: buildClinicalDocumentIntegrityHash(hydrated),
  };
};

const validateReadRecord = (record: ClinicalDocumentRecord): ClinicalDocumentRecord | null => {
  const parsed = safeParseClinicalDocumentRecord(hydrateLegacyClinicalDocument(record));
  if (!parsed.success) {
    recordOperationalTelemetry({
      category: 'clinical_document',
      status: 'failed',
      operation: 'clinical_document_repository_invalid_read_record',
      issues: formatClinicalDocumentContractIssues(parsed.error.issues),
      context: { documentId: record.id, documentType: record.documentType },
    });
    return null;
  }

  return parsed.data;
};

export const ClinicalDocumentRepository = {
  async listByEpisode(
    episodeKey: string,
    hospitalId: string = getActiveHospitalId()
  ): Promise<ClinicalDocumentRecord[]> {
    if (!isFirestoreEnabled()) {
      return [];
    }

    const documents = await firestoreDb.getDocs<ClinicalDocumentRecord>(
      getClinicalDocumentsCollectionPath(hospitalId),
      {
        where: [{ field: 'episodeKey', operator: '==', value: episodeKey }],
      }
    );
    return sortDocuments(
      documents
        .map(document => validateReadRecord(document))
        .filter((document): document is ClinicalDocumentRecord => Boolean(document))
    );
  },

  async listByEpisodeKeys(
    episodeKeys: string[],
    hospitalId: string = getActiveHospitalId()
  ): Promise<ClinicalDocumentRecord[]> {
    const sanitizedEpisodeKeys = normalizeEpisodeKeys(episodeKeys);
    if (sanitizedEpisodeKeys.length === 0) {
      return [];
    }
    if (!isFirestoreEnabled()) {
      return [];
    }

    const chunks = chunkArray(sanitizedEpisodeKeys, EPISODE_KEY_QUERY_CHUNK_SIZE);
    const chunkedResults = await Promise.all(
      chunks.map(chunk =>
        firestoreDb.getDocs<ClinicalDocumentRecord>(
          getClinicalDocumentsCollectionPath(hospitalId),
          {
            where: [{ field: 'episodeKey', operator: 'in', value: chunk }],
          }
        )
      )
    );

    const deduplicated = new Map<string, ClinicalDocumentRecord>();
    chunkedResults.flat().forEach(document => {
      const key = document.id || `${document.episodeKey}-${document.audit?.updatedAt || ''}`;
      deduplicated.set(key, document);
    });

    return sortDocuments(
      Array.from(deduplicated.values())
        .map(document => validateReadRecord(document))
        .filter((document): document is ClinicalDocumentRecord => Boolean(document))
    );
  },

  async get(
    documentId: string,
    hospitalId: string = getActiveHospitalId()
  ): Promise<ClinicalDocumentRecord | null> {
    if (!isFirestoreEnabled()) {
      return null;
    }

    const document = await firestoreDb.getDoc<ClinicalDocumentRecord>(
      getClinicalDocumentsCollectionPath(hospitalId),
      documentId
    );
    return document ? validateReadRecord(document) : null;
  },

  async createDraft(
    record: ClinicalDocumentRecord,
    hospitalId: string = getActiveHospitalId()
  ): Promise<ClinicalDocumentRecord> {
    const enriched = sanitizeForFirestore(enrichRecord(record));
    if (!isFirestoreEnabled()) {
      return enriched;
    }

    await firestoreDb.setDoc(getClinicalDocumentsCollectionPath(hospitalId), record.id, enriched);
    return enriched;
  },

  async saveDraft(
    record: ClinicalDocumentRecord,
    hospitalId: string = getActiveHospitalId()
  ): Promise<ClinicalDocumentRecord> {
    const enriched = sanitizeForFirestore(enrichRecord(record));
    if (!isFirestoreEnabled()) {
      return enriched;
    }

    await firestoreDb.setDoc(getClinicalDocumentsCollectionPath(hospitalId), record.id, enriched, {
      merge: true,
    });
    return enriched;
  },

  async archive(
    documentId: string,
    patch: Pick<ClinicalDocumentRecord, 'status' | 'audit'>,
    hospitalId: string = getActiveHospitalId()
  ): Promise<void> {
    if (!isFirestoreEnabled()) {
      return;
    }

    await firestoreDb.updateDoc(getClinicalDocumentsCollectionPath(hospitalId), documentId, {
      status: patch.status,
      audit: patch.audit,
      isActiveEpisodeDocument: false,
    });
  },

  async savePdfMetadata(
    documentId: string,
    pdf: ClinicalDocumentPdfMeta,
    hospitalId: string = getActiveHospitalId()
  ): Promise<void> {
    if (!isFirestoreEnabled()) {
      return;
    }

    await firestoreDb.updateDoc(getClinicalDocumentsCollectionPath(hospitalId), documentId, {
      pdf: sanitizeForFirestore(pdf),
    });
  },

  subscribeByEpisode(
    episodeKey: string,
    callback: (documents: ClinicalDocumentRecord[]) => void,
    hospitalId: string = getActiveHospitalId()
  ): () => void {
    if (!isFirestoreEnabled()) {
      callback([]);
      return () => {};
    }

    return firestoreDb.subscribeQuery<ClinicalDocumentRecord>(
      getClinicalDocumentsCollectionPath(hospitalId),
      { where: [{ field: 'episodeKey', operator: '==', value: episodeKey }] },
      docs =>
        callback(
          sortDocuments(
            docs
              .map(document => validateReadRecord(document))
              .filter((document): document is ClinicalDocumentRecord => Boolean(document))
          )
        )
    );
  },

  async delete(documentId: string, hospitalId: string = getActiveHospitalId()): Promise<void> {
    if (!isFirestoreEnabled()) {
      return;
    }

    await firestoreDb.deleteDoc(getClinicalDocumentsCollectionPath(hospitalId), documentId);
  },
};
