import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, Loader2, FileText } from 'lucide-react';
import type { PatientData } from '@/types';
import type { DischargeFormData } from '@/services/pdf/ieehPdfService';
import { downloadIEEHForm } from '@/services/pdf/ieehPdfService';
import { searchDiagnoses, forceAISearch } from '@/services/terminology/terminologyService';
import type { TerminologyConcept } from '@/services/terminology/terminologyService';

interface IEEHFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientData;
  baseDischargeData: DischargeFormData;
}

export const IEEHFormDialog: React.FC<IEEHFormDialogProps> = ({
  isOpen,
  onClose,
  patient,
  baseDischargeData,
}) => {
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

  // Initialize from patient data
  useEffect(() => {
    if (isOpen) {
      setDiagnostico(patient.cie10Description || patient.pathology || '');
      setCie10Code(patient.cie10Code || '');
      setCie10Display(patient.cie10Description || '');
      setError('');
    }
  }, [isOpen, patient]);

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
      await downloadIEEHForm(patient, fullDischargeData);
      onClose();
    } catch (err) {
      console.error('[IEEH] Error generando formulario:', err);
      setError('Error al generar el PDF. Revise la consola.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <FileText className="text-emerald-600" size={20} />
            <h2 className="text-lg font-bold text-slate-800">
              Egreso Estadístico — {patient.patientName || 'Paciente'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* ── SECTION 1: Diagnóstico Principal ── */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                #33
              </span>
              Diagnóstico Principal
            </legend>
            <div className="relative">
              <input
                type="text"
                value={diagnostico}
                onChange={e => handleDiagnosticoChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                placeholder="Escriba el diagnóstico..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 pr-24"
              />
              <div className="absolute right-1 top-1 flex gap-1">
                {isSearching && (
                  <Loader2 size={14} className="animate-spin text-slate-400 mt-1.5" />
                )}
                <button
                  type="button"
                  onClick={handleAISearch}
                  disabled={isAISearching || diagnostico.length < 2}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200 rounded hover:bg-violet-100 disabled:opacity-40 transition-colors"
                >
                  {isAISearching ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  IA
                </button>
              </div>

              {/* CIE-10 search results dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map(r => (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => selectCIE10(r)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 border-b border-slate-100 last:border-0"
                    >
                      <span className="font-mono font-bold text-emerald-700">{r.code}</span>
                      <span className="text-slate-500 mx-1">—</span>
                      <span className="text-slate-700">{r.display}</span>
                      {r.fromAI && <span className="ml-1 text-[10px] text-violet-500">⚡IA</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CIE-10 Code display */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Código CIE-10:</label>
              <input
                type="text"
                value={cie10Code}
                onChange={e => setCie10Code(e.target.value.toUpperCase())}
                placeholder="Ej: E11.9"
                className="px-2 py-1 border border-slate-300 rounded text-sm font-mono font-bold w-28 focus:ring-2 focus:ring-emerald-500"
              />
              {cie10Display && cie10Display !== diagnostico && (
                <span className="text-xs text-slate-400 truncate">{cie10Display}</span>
              )}
            </div>
          </fieldset>

          {/* ── SECTION: Condición de Egreso ── */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                #31
              </span>
              Condición al Egreso
            </legend>
            <select
              value={condicionEgreso}
              onChange={e => setCondicionEgreso(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 bg-white"
            >
              <option value="1">1. Domicilio</option>
              <option value="2">2. Derivación a otro establecimiento de la red pública</option>
              <option value="3">3. Derivación a institución privada</option>
              <option value="4">4. Derivación a otros centros u otra institución</option>
              <option value="5">5. Alta voluntaria</option>
              <option value="6">6. Fuga del paciente</option>
              <option value="7">7. Hospitalización domiciliaria</option>
            </select>
          </fieldset>

          {/* ── SECTION 2: Intervención Quirúrgica ── */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                #39
              </span>
              Intervención Quirúrgica
            </legend>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="intervencion"
                  checked={tieneIntervencion === true}
                  onChange={() => setTieneIntervencion(true)}
                  className="accent-blue-600"
                />
                <span className="text-sm">Sí</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="intervencion"
                  checked={tieneIntervencion === false}
                  onChange={() => {
                    setTieneIntervencion(false);
                    setIntervencionDescrip('');
                  }}
                  className="accent-blue-600"
                />
                <span className="text-sm">No</span>
              </label>
            </div>
            {tieneIntervencion && (
              <input
                type="text"
                value={intervencionDescrip}
                onChange={e => setIntervencionDescrip(e.target.value)}
                placeholder="Descripción de la intervención quirúrgica..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            )}
          </fieldset>

          {/* ── SECTION 3: Procedimiento ── */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                #42
              </span>
              Procedimiento
            </legend>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="procedimiento"
                  checked={tieneProcedimiento === true}
                  onChange={() => setTieneProcedimiento(true)}
                  className="accent-amber-600"
                />
                <span className="text-sm">Sí</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="procedimiento"
                  checked={tieneProcedimiento === false}
                  onChange={() => {
                    setTieneProcedimiento(false);
                    setProcedimientoDescrip('');
                  }}
                  className="accent-amber-600"
                />
                <span className="text-sm">No</span>
              </label>
            </div>
            {tieneProcedimiento && (
              <input
                type="text"
                value={procedimientoDescrip}
                onChange={e => setProcedimientoDescrip(e.target.value)}
                placeholder="Descripción del procedimiento..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
              />
            )}
          </fieldset>

          {/* ── SECTION 4: Médico Tratante ── */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                #49
              </span>
              Médico Tratante
            </legend>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={tratanteAp1}
                onChange={e => setTratanteAp1(e.target.value)}
                placeholder="Primer Apellido"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
              />
              <input
                type="text"
                value={tratanteAp2}
                onChange={e => setTratanteAp2(e.target.value)}
                placeholder="Segundo Apellido"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
              />
              <input
                type="text"
                value={tratanteNombre}
                onChange={e => setTratanteNombre(e.target.value)}
                placeholder="Nombre"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <input
              type="text"
              value={tratanteRut}
              onChange={e => setTratanteRut(e.target.value)}
              placeholder="RUT del médico (ej: 12.345.678-9)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-rose-500"
            />
          </fieldset>

          {/* Error */}
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            {isGenerating ? 'Generando...' : 'Generar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};
