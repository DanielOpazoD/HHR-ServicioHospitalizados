import React from 'react';
import { FileText, Loader2, Sparkles, X } from 'lucide-react';

import type { TerminologyConcept } from '@/services/terminology/terminologyService';

const dischargeConditionOptions = [
  '1. Domicilio',
  '2. Derivación a otro establecimiento de la red pública',
  '3. Derivación a institución privada',
  '4. Derivación a otros centros u otra institución',
  '5. Alta voluntaria',
  '6. Fuga del paciente',
  '7. Hospitalización domiciliaria',
];

const medicoTratanteInputClassName =
  'px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-400';

const buildIEEHFieldClassName = (extraClasses = '') =>
  ['w-full px-3 py-2 border border-slate-300 rounded-lg text-sm', extraClasses]
    .filter(Boolean)
    .join(' ');

const buildIEEHReadOnlyFieldClassName = (extraClasses = '') =>
  [
    'px-2 py-1 border border-slate-300 rounded text-sm font-mono font-bold w-28 bg-slate-50 text-slate-500 cursor-not-allowed',
    extraClasses,
  ]
    .filter(Boolean)
    .join(' ');

export const IEEHDialogHeader: React.FC<{
  patientName: string;
  onClose: () => void;
}> = ({ patientName, onClose }) => (
  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-xl">
    <div className="flex items-center gap-2">
      <FileText className="text-emerald-600" size={20} />
      <h2 className="text-lg font-bold text-slate-800">
        Egreso Estadístico — {patientName || 'Paciente'}
      </h2>
    </div>
    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 transition-colors">
      <X size={20} className="text-slate-500" />
    </button>
  </div>
);

export const DiagnosticoPrincipalSection: React.FC<{
  diagnostico: string;
  cie10Code: string;
  cie10Display: string;
  searchResults: TerminologyConcept[];
  isSearching: boolean;
  isAISearching: boolean;
  showResults: boolean;
  setShowResults: (show: boolean) => void;
  handleDiagnosticoChange: (value: string) => void;
  handleAISearch: () => void;
  selectCIE10: (concept: TerminologyConcept) => void;
}> = ({
  diagnostico,
  cie10Code,
  cie10Display,
  searchResults,
  isSearching,
  isAISearching,
  showResults,
  setShowResults,
  handleDiagnosticoChange,
  handleAISearch,
  selectCIE10,
}) => (
  <fieldset className="space-y-2">
    <legend className="text-sm font-semibold text-slate-700">Diagnóstico Principal</legend>
    <div className="relative">
      <input
        type="text"
        value={diagnostico}
        onChange={e => handleDiagnosticoChange(e.target.value)}
        onFocus={() => searchResults.length > 0 && setShowResults(true)}
        placeholder="Escriba el diagnóstico..."
        className={buildIEEHFieldClassName(
          'focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 pr-24'
        )}
      />
      <div className="absolute right-1 top-1 flex gap-1">
        {isSearching && <Loader2 size={14} className="animate-spin text-slate-400 mt-1.5" />}
        <button
          type="button"
          onClick={handleAISearch}
          disabled={isAISearching || diagnostico.length < 2}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200 rounded hover:bg-violet-100 disabled:opacity-40 transition-colors"
        >
          {isAISearching ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          IA
        </button>
      </div>

      {showResults && searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {searchResults.map(result => (
            <button
              key={result.code}
              type="button"
              onClick={() => selectCIE10(result)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 border-b border-slate-100 last:border-0"
            >
              <span className="font-mono font-bold text-emerald-700">{result.code}</span>
              <span className="text-slate-500 mx-1">—</span>
              <span className="text-slate-700">{result.display}</span>
              {result.fromAI && <span className="ml-1 text-[10px] text-violet-500">⚡IA</span>}
            </button>
          ))}
        </div>
      )}
    </div>

    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-500">Código CIE-10:</label>
      <input
        type="text"
        value={cie10Code}
        readOnly
        placeholder=""
        className={buildIEEHReadOnlyFieldClassName()}
      />
      {cie10Display && cie10Display !== diagnostico && (
        <span className="text-xs text-slate-400 truncate">{cie10Display}</span>
      )}
    </div>
  </fieldset>
);

export const CondicionEgresoSection: React.FC<{
  condicionEgreso: string;
  setCondicionEgreso: (value: string) => void;
}> = ({ condicionEgreso, setCondicionEgreso }) => (
  <fieldset className="space-y-2">
    <legend className="text-sm font-semibold text-slate-700">Condición al Egreso</legend>
    <select
      value={condicionEgreso}
      onChange={e => setCondicionEgreso(e.target.value)}
      className={buildIEEHFieldClassName('focus:ring-2 focus:ring-slate-500 bg-white')}
    >
      {dischargeConditionOptions.map(option => {
        const [value] = option.split('.');
        return (
          <option key={value} value={value}>
            {option}
          </option>
        );
      })}
    </select>
  </fieldset>
);

export const BinaryTextSection: React.FC<{
  legendLabel: string;
  name: string;
  enabled: boolean;
  placeholder: string;
  value: string;
  onEnable: () => void;
  onDisable: () => void;
  onChange: (value: string) => void;
}> = ({ legendLabel, name, enabled, placeholder, value, onEnable, onDisable, onChange }) => (
  <fieldset className="space-y-2">
    <div className="flex items-center gap-3">
      <legend className="text-sm font-semibold text-slate-700">{legendLabel}</legend>
      <label className="flex items-center gap-1 cursor-pointer">
        <input
          type="radio"
          name={name}
          checked={enabled}
          onChange={onEnable}
          className="accent-blue-600"
        />
        <span className="text-sm">Sí</span>
      </label>
      <label className="flex items-center gap-1 cursor-pointer">
        <input
          type="radio"
          name={name}
          checked={!enabled}
          onChange={onDisable}
          className="accent-blue-600"
        />
        <span className="text-sm">No</span>
      </label>
    </div>
    {enabled && (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={buildIEEHFieldClassName('focus:ring-2 focus:ring-blue-500')}
      />
    )}
  </fieldset>
);

export const MedicoTratanteSection: React.FC<{
  tratanteNombre: string;
  tratanteAp1: string;
  tratanteAp2: string;
  tratanteRut: string;
  setTratanteNombre: (value: string) => void;
  setTratanteAp1: (value: string) => void;
  setTratanteAp2: (value: string) => void;
  setTratanteRut: (value: string) => void;
}> = ({
  tratanteNombre,
  tratanteAp1,
  tratanteAp2,
  tratanteRut,
  setTratanteNombre,
  setTratanteAp1,
  setTratanteAp2,
  setTratanteRut,
}) => (
  <fieldset className="space-y-2">
    <legend className="text-sm font-semibold text-slate-700">Médico Tratante</legend>
    {/*
      Keep the same blue focus treatment as the rest of the discharge modal.
      The default browser outline combined with a custom ring was producing a double contour.
    */}
    <div className="grid grid-cols-3 gap-2">
      <input
        type="text"
        value={tratanteNombre}
        onChange={e => setTratanteNombre(e.target.value)}
        placeholder="Nombre"
        className={medicoTratanteInputClassName}
      />
      <input
        type="text"
        value={tratanteAp1}
        onChange={e => setTratanteAp1(e.target.value)}
        placeholder="Primer Apellido"
        className={medicoTratanteInputClassName}
      />
      <input
        type="text"
        value={tratanteAp2}
        onChange={e => setTratanteAp2(e.target.value)}
        placeholder="Segundo Apellido"
        className={medicoTratanteInputClassName}
      />
    </div>
    <input
      type="text"
      value={tratanteRut}
      onChange={e => setTratanteRut(e.target.value)}
      placeholder="RUT del médico (ej: 12.345.678-9)"
      className={`${medicoTratanteInputClassName} w-64`}
    />
  </fieldset>
);

export const IEEHDialogFooter: React.FC<{
  isGenerating: boolean;
  onClose: () => void;
  onGenerate: () => void;
}> = ({ isGenerating, onClose, onGenerate }) => (
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
      onClick={onGenerate}
      disabled={isGenerating}
      className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
    >
      {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
      {isGenerating ? 'Preparando impresión...' : 'Imprimir documento'}
    </button>
  </div>
);
