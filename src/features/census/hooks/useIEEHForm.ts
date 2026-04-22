import { useState, useEffect, useCallback, useRef } from 'react';
import type { PatientData } from '@/features/census/controllers/censusActionPatientContracts';
import type { IeehData } from '@/features/census/contracts/censusMovementContracts';
import type { DischargeFormData } from '@/services/pdf/ieehPdfService';
import { printIEEHForm } from '@/services/pdf/ieehPdfService';
import { searchDiagnoses, forceAISearch } from '@/services/terminology/terminologyService';
import type { TerminologyConcept } from '@/services/terminology/terminologyService';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntimeCore';
import {
  buildIeehInitialDraftValues,
  buildIeehPrintDischargeData,
  buildPersistedIeehData,
} from '@/features/census/controllers/ieehFormDataController';
import { createScopedLogger } from '@/services/utils/loggerScope';

export interface UseIEEHFormProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientData;
  baseDischargeData: DischargeFormData;
  savedIeehData?: IeehData;
  onSaveData?: (data: IeehData) => void;
}

const ieehFormLogger = createScopedLogger('IEEHForm');

export function useIEEHForm({
  isOpen,
  onClose,
  patient,
  baseDischargeData,
  savedIeehData,
  onSaveData,
}: UseIEEHFormProps) {
  // ── Diagnosis fields ──
  const [diagnostico, setDiagnostico] = useState('');
  const [cie10Code, setCie10Code] = useState('');
  const [cie10Display, setCie10Display] = useState('');

  // ── CIE-10 Search ──
  const [searchResults, setSearchResults] = useState<TerminologyConcept[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);

  // ── Condición de Egreso ──
  const [condicionEgreso, setCondicionEgreso] = useState('1');

  // ── Surgery ──
  const [tieneIntervencion, setTieneIntervencion] = useState(false);
  const [intervencionDescrip, setIntervencionDescrip] = useState('');

  // ── Procedure ──
  const [tieneProcedimiento, setTieneProcedimiento] = useState(false);
  const [procedimientoDescrip, setProcedimientoDescrip] = useState('');

  // ── Treating Doctor ──
  const [tratanteAp1, setTratanteAp1] = useState('');
  const [tratanteAp2, setTratanteAp2] = useState('');
  const [tratanteNombre, setTratanteNombre] = useState('');
  const [tratanteRut, setTratanteRut] = useState('');

  // ── State ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  // Initialize from patient data or saved IEEH data
  useEffect(() => {
    if (isOpen) {
      const initialValues = buildIeehInitialDraftValues(patient, savedIeehData);
      setDiagnostico(initialValues.diagnosticoPrincipal);
      setCie10Code(initialValues.cie10Code);
      setCie10Display(initialValues.cie10Display);
      setCondicionEgreso(initialValues.condicionEgreso);
      setTieneIntervencion(initialValues.tieneIntervencion);
      setIntervencionDescrip(initialValues.intervencionDescrip);
      setTieneProcedimiento(initialValues.tieneProcedimiento);
      setProcedimientoDescrip(initialValues.procedimientoDescrip);
      setTratanteAp1(initialValues.tratanteApellido1);
      setTratanteAp2(initialValues.tratanteApellido2);
      setTratanteNombre(initialValues.tratanteNombre);
      setTratanteRut(initialValues.tratanteRut);
      setError('');
    }
  }, [isOpen, patient, savedIeehData]);

  // Debounced CIE-10 search
  const handleDiagnosticoSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    abortController.current?.abort();
    abortController.current = new AbortController();

    setIsSearching(true);
    try {
      const results = await searchDiagnoses(query, abortController.current.signal);
      setSearchResults(results);
      setShowResults(results.length > 0);
    } catch {
      // Aborted or error
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleDiagnosticoChange = (value: string) => {
    setDiagnostico(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => handleDiagnosticoSearch(value), 300);
  };

  const handleAISearch = async () => {
    if (diagnostico.length < 2) return;

    abortController.current?.abort();
    abortController.current = new AbortController();

    setIsAISearching(true);
    try {
      const results = await forceAISearch(diagnostico, abortController.current.signal);
      setSearchResults(results);
      setShowResults(results.length > 0);
    } catch {
      // Aborted
    } finally {
      setIsAISearching(false);
    }
  };

  const selectCIE10 = (concept: TerminologyConcept) => {
    setCie10Code(concept.code);
    setCie10Display(concept.display);
    setDiagnostico(concept.display);
    setShowResults(false);
  };

  const handleGenerate = async () => {
    const reservedPrintWindow = defaultBrowserWindowRuntime.open('', '_blank');
    setIsGenerating(true);
    setError('');
    try {
      const draftValues = {
        diagnosticoPrincipal: diagnostico,
        cie10Code,
        cie10Display,
        condicionEgreso,
        tieneIntervencion,
        intervencionDescrip,
        tieneProcedimiento,
        procedimientoDescrip,
        tratanteApellido1: tratanteAp1,
        tratanteApellido2: tratanteAp2,
        tratanteNombre,
        tratanteRut,
      };
      const persistedIeehData = buildPersistedIeehData(draftValues);
      const fullDischargeData: DischargeFormData = buildIeehPrintDischargeData(
        baseDischargeData,
        draftValues
      );

      onSaveData?.(persistedIeehData);

      await printIEEHForm(patient, fullDischargeData, reservedPrintWindow);
      onClose();
    } catch (err) {
      reservedPrintWindow?.close();
      ieehFormLogger.error('Error generating IEEH form', err);
      setError('Error al generar el PDF. Revise la consola.');
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    state: {
      diagnostico,
      cie10Code,
      cie10Display,
      searchResults,
      isSearching,
      isAISearching,
      showResults,
      condicionEgreso,
      tieneIntervencion,
      intervencionDescrip,
      tieneProcedimiento,
      procedimientoDescrip,
      tratanteAp1,
      tratanteAp2,
      tratanteNombre,
      tratanteRut,
      isGenerating,
      error,
    },
    actions: {
      setDiagnostico,
      setCie10Code,
      setCondicionEgreso,
      setTieneIntervencion,
      setIntervencionDescrip,
      setTieneProcedimiento,
      setProcedimientoDescrip,
      setTratanteAp1,
      setTratanteAp2,
      setTratanteNombre,
      setTratanteRut,
      setShowResults,
      handleDiagnosticoChange,
      handleAISearch,
      selectCIE10,
      handleGenerate,
    },
  };
}
