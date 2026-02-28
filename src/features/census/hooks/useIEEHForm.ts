import { useState, useEffect, useCallback, useRef } from 'react';
import type { PatientData, IeehData } from '@/types';
import type { DischargeFormData } from '@/services/pdf/ieehPdfService';
import { downloadIEEHForm } from '@/services/pdf/ieehPdfService';
import { searchDiagnoses, forceAISearch } from '@/services/terminology/terminologyService';
import type { TerminologyConcept } from '@/services/terminology/terminologyService';

export interface UseIEEHFormProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientData;
  baseDischargeData: DischargeFormData;
  savedIeehData?: IeehData;
  onSaveData?: (data: IeehData) => void;
}

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
  const [tieneIntervencion, setTieneIntervencion] = useState<boolean | null>(null);
  const [intervencionDescrip, setIntervencionDescrip] = useState('');

  // ── Procedure ──
  const [tieneProcedimiento, setTieneProcedimiento] = useState<boolean | null>(null);
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
      if (savedIeehData) {
        setDiagnostico(savedIeehData.diagnosticoPrincipal || '');
        setCie10Code(savedIeehData.cie10Code || '');
        setCie10Display(savedIeehData.diagnosticoPrincipal || '');
        setCondicionEgreso(savedIeehData.condicionEgreso || '1');

        if (savedIeehData.intervencionQuirurgica) {
          setTieneIntervencion(savedIeehData.intervencionQuirurgica === '1');
        } else {
          setTieneIntervencion(null);
        }
        setIntervencionDescrip(savedIeehData.intervencionQuirurgDescrip || '');

        if (savedIeehData.procedimiento) {
          setTieneProcedimiento(savedIeehData.procedimiento === '1');
        } else {
          setTieneProcedimiento(null);
        }
        setProcedimientoDescrip(savedIeehData.procedimientoDescrip || '');

        setTratanteAp1(savedIeehData.tratanteApellido1 || '');
        setTratanteAp2(savedIeehData.tratanteApellido2 || '');
        setTratanteNombre(savedIeehData.tratanteNombre || '');
        setTratanteRut(savedIeehData.tratanteRut || '');
      } else {
        setDiagnostico(patient.cie10Description || patient.pathology || '');
        setCie10Code(patient.cie10Code || '');
        setCie10Display(patient.cie10Description || '');

        // Reset previously unset fields for new dialog
        setCondicionEgreso('1');
        setTieneIntervencion(null);
        setIntervencionDescrip('');
        setTieneProcedimiento(null);
        setProcedimientoDescrip('');
        setTratanteAp1('');
        setTratanteAp2('');
        setTratanteNombre('');
        setTratanteRut('');
      }
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
    setIsGenerating(true);
    setError('');
    try {
      const fullDischargeData: DischargeFormData = {
        ...baseDischargeData,
        diagnosticoPrincipal: diagnostico || undefined,
        cie10Code: cie10Code || undefined,
        condicionEgreso,
        intervencionQuirurgica:
          tieneIntervencion != null ? (tieneIntervencion ? '1' : '2') : undefined,
        intervencionQuirurgDescrip: tieneIntervencion
          ? intervencionDescrip || undefined
          : undefined,
        procedimiento: tieneProcedimiento != null ? (tieneProcedimiento ? '1' : '2') : undefined,
        procedimientoDescrip: tieneProcedimiento ? procedimientoDescrip || undefined : undefined,
        tratanteApellido1: tratanteAp1 || undefined,
        tratanteApellido2: tratanteAp2 || undefined,
        tratanteNombre: tratanteNombre || undefined,
        tratanteRut: tratanteRut || undefined,
      };

      if (onSaveData) {
        onSaveData({
          diagnosticoPrincipal: diagnostico || undefined,
          cie10Code: cie10Code || undefined,
          condicionEgreso,
          intervencionQuirurgica:
            tieneIntervencion != null ? (tieneIntervencion ? '1' : '2') : undefined,
          intervencionQuirurgDescrip: tieneIntervencion
            ? intervencionDescrip || undefined
            : undefined,
          procedimiento: tieneProcedimiento != null ? (tieneProcedimiento ? '1' : '2') : undefined,
          procedimientoDescrip: tieneProcedimiento ? procedimientoDescrip || undefined : undefined,
          tratanteApellido1: tratanteAp1 || undefined,
          tratanteApellido2: tratanteAp2 || undefined,
          tratanteNombre: tratanteNombre || undefined,
          tratanteRut: tratanteRut || undefined,
        });
      }

      await downloadIEEHForm(patient, fullDischargeData);
      onClose();
    } catch (err) {
      console.error('[IEEH] Error generando formulario:', err);
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
