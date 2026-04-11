/**
 * useGlobalPatientSearch Hook
 *
 * Encapsulates global patient search logic: debounced query,
 * auto-detect RUT vs name, episode loading, and clinical document fetching.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { MasterPatient } from '@/types/domain/patientMaster';
import type { PatientHistoryResult } from '@/services/patient/patientHistoryService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClinicalDocSummary {
  id: string;
  documentType: string;
  status: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface SelectedPatientDetail {
  master: MasterPatient;
  history: PatientHistoryResult | null;
  isLoadingHistory: boolean;
}

export interface EpisodeDocuments {
  episodeKey: string;
  docs: ClinicalDocSummary[];
  isLoading: boolean;
}

export interface UseGlobalPatientSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: MasterPatient[];
  isSearching: boolean;
  hasSearched: boolean;
  selectedPatient: SelectedPatientDetail | null;
  selectPatient: (patient: MasterPatient) => void;
  clearSelection: () => void;
  episodeDocuments: Record<string, EpisodeDocuments>;
  loadEpisodeDocuments: (episodeKey: string) => void;
  downloadDocumentPdf: (docId: string, docType: string) => Promise<void>;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 20;
const RUT_PATTERN = /^[\d]{1,2}\.?[\d]{3}\.?[\d]{3}-?[\dkK]?$/;

// ---------------------------------------------------------------------------
// Lazy module loaders
// ---------------------------------------------------------------------------

let patientMasterRepoPromise: Promise<
  typeof import('@/services/repositories/PatientMasterRepository')
> | null = null;
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

const loadPatientMasterRepo = () => {
  patientMasterRepoPromise ??= import('@/services/repositories/PatientMasterRepository');
  return patientMasterRepoPromise;
};

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

const _looksLikeRut = (input: string): boolean => RUT_PATTERN.test(input.trim());

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGlobalPatientSearch(): UseGlobalPatientSearchReturn {
  const [query, setQueryRaw] = useState('');
  const [results, setResults] = useState<MasterPatient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatientDetail | null>(null);
  const [episodeDocuments, setEpisodeDocuments] = useState<Record<string, EpisodeDocuments>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchIdRef = useRef(0);

  // ---- Debounced search ----
  const setQuery = useCallback((q: string) => {
    setQueryRaw(q);
    setSelectedIndex(0);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const currentId = ++searchIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const repo = await loadPatientMasterRepo();
        const found = await repo.searchPatients(trimmed, SEARCH_LIMIT);

        if (currentId !== searchIdRef.current) return;

        setResults(found);
      } catch {
        if (currentId === searchIdRef.current) setResults([]);
      } finally {
        if (currentId === searchIdRef.current) {
          setIsSearching(false);
          setHasSearched(true);
        }
      }
    }, DEBOUNCE_MS);
  }, []);

  // ---- Select patient → load history ----
  const selectPatient = useCallback(async (patient: MasterPatient) => {
    setSelectedPatient({ master: patient, history: null, isLoadingHistory: true });

    try {
      const historyModule = await loadPatientHistory();
      const history = await historyModule.getPatientMovementHistory(patient.rut);
      setSelectedPatient(prev =>
        prev?.master.rut === patient.rut ? { ...prev, history, isLoadingHistory: false } : prev
      );
    } catch {
      setSelectedPatient(prev =>
        prev?.master.rut === patient.rut ? { ...prev, isLoadingHistory: false } : prev
      );
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPatient(null);
    setEpisodeDocuments({});
  }, []);

  // ---- Load clinical documents for an episode ----
  // The episodeKey format is `RUT__admissionDate`. The RUT format may vary
  // (with/without dots), so we try multiple candidates until we find docs.
  const loadEpisodeDocuments = useCallback(async (compositeKey: string) => {
    setEpisodeDocuments(prev => {
      if (prev[compositeKey]?.docs.length) return prev;
      return { ...prev, [compositeKey]: { episodeKey: compositeKey, docs: [], isLoading: true } };
    });

    try {
      const [docMod, episodeMod] = await Promise.all([
        loadClinicalDocRepo(),
        loadClinicalEpisode(),
      ]);

      // Parse the composite key to extract rut and date
      const [rut, admissionDate] = compositeKey.split('__');

      // Build candidate keys using the canonical builder with RUT variations
      const rutWithoutDots = rut.replace(/\./g, '');
      const candidateKeys = [
        ...new Set([
          episodeMod.buildClinicalEpisodeKey(rut, admissionDate),
          episodeMod.buildClinicalEpisodeKey(rutWithoutDots, admissionDate),
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
    } catch {
      setEpisodeDocuments(prev => ({
        ...prev,
        [compositeKey]: { episodeKey: compositeKey, docs: [], isLoading: false },
      }));
    }
  }, []);

  // ---- Download a single clinical document as PDF ----
  const downloadDocumentPdf = useCallback(async (docId: string, docType: string) => {
    const [docMod, pdfMod] = await Promise.all([loadClinicalDocRepo(), loadClinicalDocPdf()]);

    const record = await docMod.ClinicalDocumentRepository.get(docId);
    if (!record) return;

    const blob = await pdfMod.generateClinicalDocumentPdfBlob(record);

    const patientName = record.patientName?.replace(/\s+/g, '_') || 'paciente';
    const fileName = `${docType}_${patientName}.pdf`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // ---- Reset ----
  const reset = useCallback(() => {
    setQueryRaw('');
    setResults([]);
    setIsSearching(false);
    setHasSearched(false);
    setSelectedPatient(null);
    setEpisodeDocuments({});
    setSelectedIndex(0);
    searchIdRef.current++;
  }, []);

  // ---- Cleanup ----
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return useMemo(
    () => ({
      query,
      setQuery,
      results,
      isSearching,
      hasSearched,
      selectedPatient,
      selectPatient,
      clearSelection,
      episodeDocuments,
      loadEpisodeDocuments,
      downloadDocumentPdf,
      selectedIndex,
      setSelectedIndex,
      reset,
    }),
    [
      query,
      setQuery,
      results,
      isSearching,
      hasSearched,
      selectedPatient,
      selectPatient,
      clearSelection,
      episodeDocuments,
      loadEpisodeDocuments,
      downloadDocumentPdf,
      selectedIndex,
      setSelectedIndex,
      reset,
    ]
  );
}
