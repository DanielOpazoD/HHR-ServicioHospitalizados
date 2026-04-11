/**
 * usePatientSelection
 *
 * Handles selecting a patient from search results and loading
 * their movement history and clinical episode documents.
 */

import { useState, useCallback } from 'react';
import type { MasterPatient } from '@/types/domain/patientMaster';
import type {
  SelectedPatientDetail,
  EpisodeDocuments,
  ClinicalDocSummary,
} from '@/features/census/components/global-search/globalSearchContracts';
import { globalPatientSearchLogger } from '@/hooks/hookLoggers';

// ---------------------------------------------------------------------------
// Lazy loaders
// ---------------------------------------------------------------------------

let patientHistoryPromise: Promise<
  typeof import('@/services/patient/patientHistoryService')
> | null = null;
let clinicalDocRepoPromise: Promise<
  typeof import('@/services/repositories/ClinicalDocumentRepository')
> | null = null;
let clinicalEpisodePromise: Promise<
  typeof import('@/application/patient-flow/clinicalEpisode')
> | null = null;
let clinicalDocPdfPromise: Promise<
  typeof import('@/features/clinical-documents/services/clinicalDocumentPdfService')
> | null = null;

const loadPatientHistory = () => {
  patientHistoryPromise ??= import('@/services/patient/patientHistoryService');
  return patientHistoryPromise;
};
const loadClinicalDocRepo = () => {
  clinicalDocRepoPromise ??= import('@/services/repositories/ClinicalDocumentRepository');
  return clinicalDocRepoPromise;
};
const loadClinicalEpisode = () => {
  clinicalEpisodePromise ??= import('@/application/patient-flow/clinicalEpisode');
  return clinicalEpisodePromise;
};
const loadClinicalDocPdf = () => {
  clinicalDocPdfPromise ??=
    import('@/features/clinical-documents/services/clinicalDocumentPdfService');
  return clinicalDocPdfPromise;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parseCompositeEpisodeKey = (key: string): { rut: string; admissionDate: string } | null => {
  const separatorIdx = key.indexOf('__');
  if (separatorIdx < 1) return null;
  const rut = key.slice(0, separatorIdx);
  const admissionDate = key.slice(separatorIdx + 2);
  if (!rut || !admissionDate) return null;
  return { rut, admissionDate };
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UsePatientSelectionReturn {
  selectedPatient: SelectedPatientDetail | null;
  selectPatient: (patient: MasterPatient) => void;
  clearSelection: () => void;
  episodeDocuments: Record<string, EpisodeDocuments>;
  loadEpisodeDocuments: (episodeKey: string) => void;
  downloadDocumentPdf: (docId: string, docType: string) => Promise<void>;
  resetSelection: () => void;
}

export function usePatientSelection(): UsePatientSelectionReturn {
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatientDetail | null>(null);
  const [episodeDocuments, setEpisodeDocuments] = useState<Record<string, EpisodeDocuments>>({});

  const selectPatient = useCallback(async (patient: MasterPatient) => {
    setSelectedPatient({ master: patient, history: null, isLoadingHistory: true });

    try {
      const historyModule = await loadPatientHistory();
      const history = await historyModule.getPatientMovementHistory(patient.rut);
      setSelectedPatient(prev =>
        prev && prev.master.rut === patient.rut
          ? { ...prev, history, isLoadingHistory: false }
          : prev
      );
    } catch (err) {
      globalPatientSearchLogger.warn(`Failed to load history for ${patient.rut}`, err);
      setSelectedPatient(prev =>
        prev && prev.master.rut === patient.rut ? { ...prev, isLoadingHistory: false } : prev
      );
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPatient(null);
    setEpisodeDocuments({});
  }, []);

  const loadEpisodeDocuments = useCallback(async (compositeKey: string) => {
    const parsed = parseCompositeEpisodeKey(compositeKey);
    if (!parsed) {
      globalPatientSearchLogger.warn(`Malformed episode key: ${compositeKey}`);
      return;
    }

    // Prevent concurrent loading for the same key
    setEpisodeDocuments(prev => {
      if (prev[compositeKey]?.isLoading || prev[compositeKey]?.docs.length) return prev;
      return { ...prev, [compositeKey]: { episodeKey: compositeKey, docs: [], isLoading: true } };
    });

    try {
      const [docMod, episodeMod] = await Promise.all([
        loadClinicalDocRepo(),
        loadClinicalEpisode(),
      ]);

      const rutWithoutDots = parsed.rut.replace(/\./g, '');
      const candidateKeys = [
        ...new Set([
          episodeMod.buildClinicalEpisodeKey(parsed.rut, parsed.admissionDate),
          episodeMod.buildClinicalEpisodeKey(rutWithoutDots, parsed.admissionDate),
        ]),
      ];

      let foundDocs: ClinicalDocSummary[] = [];
      for (const candidateKey of candidateKeys) {
        const docs = await docMod.ClinicalDocumentRepository.listByEpisode(candidateKey);
        if (docs.length > 0) {
          foundDocs = docs.map(d => ({
            id: d.id || '',
            documentType: d.documentType || '',
            status: d.status || '',
            createdAt: d.audit?.createdAt || '',
            createdBy: d.audit?.createdBy?.displayName || '',
            updatedAt: d.audit?.updatedAt || '',
          }));
          break;
        }
      }

      setEpisodeDocuments(prev => ({
        ...prev,
        [compositeKey]: { episodeKey: compositeKey, docs: foundDocs, isLoading: false },
      }));
    } catch (err) {
      globalPatientSearchLogger.warn(`Failed to load documents for ${compositeKey}`, err);
      setEpisodeDocuments(prev => ({
        ...prev,
        [compositeKey]: { episodeKey: compositeKey, docs: [], isLoading: false },
      }));
    }
  }, []);

  /** Generate a clinical document PDF and open it in a new browser tab for preview. */
  const downloadDocumentPdf = useCallback(async (docId: string, _docType: string) => {
    try {
      const [docMod, pdfMod] = await Promise.all([loadClinicalDocRepo(), loadClinicalDocPdf()]);

      const record = await docMod.ClinicalDocumentRepository.get(docId);
      if (!record) {
        globalPatientSearchLogger.warn(`Document not found for PDF preview: ${docId}`);
        return;
      }

      const blob = await pdfMod.generateClinicalDocumentPdfBlob(record);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      globalPatientSearchLogger.error(`PDF preview failed for document ${docId}`, err);
      throw err;
    }
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedPatient(null);
    setEpisodeDocuments({});
  }, []);

  return {
    selectedPatient,
    selectPatient,
    clearSelection,
    episodeDocuments,
    loadEpisodeDocuments,
    downloadDocumentPdf,
    resetSelection,
  };
}
