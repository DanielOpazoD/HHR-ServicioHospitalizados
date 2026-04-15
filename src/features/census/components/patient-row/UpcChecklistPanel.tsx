import React from 'react';
import clsx from 'clsx';
import { ShieldCheck, X } from 'lucide-react';
import { UPC_UCI_CRITERIA, UPC_UTI_CRITERIA } from '@/domain/upc/upcCriteria';
import {
  resolveUpcClassificationLabel,
  resolveUpcBadgeColor,
} from '@/domain/upc/upcClassification';
import type { UpcClassification } from '@/domain/upc/upcClassification';

interface UpcChecklistPanelProps {
  draftUci: ReadonlySet<string>;
  draftUti: ReadonlySet<string>;
  draftClassification: UpcClassification;
  hasDraftCriteria: boolean;
  /** Whether UCI criteria can be selected (false for Neo1/Neo2 per protocol §3). */
  uciAllowed: boolean;
  onToggleUci: (id: string) => void;
  onToggleUti: (id: string) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
}

const CriterionCheckbox: React.FC<{
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
  accent?: 'red' | 'amber';
}> = ({ id, label, checked, disabled = false, onToggle, accent = 'amber' }) => (
  <label
    className={clsx(
      'flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors text-[11px] leading-snug',
      disabled
        ? 'opacity-40 cursor-not-allowed'
        : checked
          ? accent === 'red'
            ? 'bg-red-50 text-red-800 cursor-pointer'
            : 'bg-amber-50 text-amber-800 cursor-pointer'
          : 'text-slate-600 hover:bg-slate-50 cursor-pointer'
    )}
    aria-label={label}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={() => onToggle(id)}
      className={clsx(
        'mt-0.5 w-3.5 h-3.5 rounded shrink-0',
        accent === 'red' ? 'text-red-600' : 'text-amber-600'
      )}
      aria-label={label}
    />
    <span>{label}</span>
  </label>
);

export const UpcChecklistPanel: React.FC<UpcChecklistPanelProps> = ({
  draftUci,
  draftUti,
  draftClassification,
  hasDraftCriteria,
  uciAllowed,
  onToggleUci,
  onToggleUti,
  onSave,
  onClear,
  onClose,
}) => {
  const badgeColors = resolveUpcBadgeColor(draftClassification);
  const classLabel = resolveUpcClassificationLabel(draftClassification);

  return (
    <div className="w-[380px] rounded-xl border border-slate-200 bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-slate-500" />
          <span className="text-[12px] font-bold text-slate-700 tracking-tight">
            Clasificación UPC
          </span>
          {draftClassification && (
            <span
              className={clsx(
                'px-1.5 py-0.5 rounded text-[10px] font-bold border',
                badgeColors.text,
                badgeColors.bg,
                badgeColors.border
              )}
            >
              {classLabel}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar checklist UPC"
          className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="max-h-[50vh] overflow-y-auto px-3 py-2 space-y-3">
        {/* UCI section */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div
              className={clsx(
                'w-1.5 h-1.5 rounded-full',
                uciAllowed ? 'bg-red-500' : 'bg-slate-300'
              )}
            />
            <span
              className={clsx(
                'text-[10px] font-bold uppercase tracking-wider',
                uciAllowed ? 'text-red-700' : 'text-slate-400'
              )}
            >
              UCI — Soporte vital avanzado
            </span>
            {!uciAllowed && (
              <span className="text-[9px] text-slate-400 font-normal normal-case">
                (no disponible en Neo)
              </span>
            )}
          </div>
          <div
            className={clsx(
              'space-y-0.5 rounded-lg border p-1',
              uciAllowed ? 'border-red-100' : 'border-slate-100'
            )}
          >
            {UPC_UCI_CRITERIA.map(c => (
              <CriterionCheckbox
                key={c.id}
                id={c.id}
                label={c.label}
                checked={draftUci.has(c.id)}
                disabled={!uciAllowed}
                onToggle={onToggleUci}
                accent="red"
              />
            ))}
          </div>
        </div>

        {/* UTI section */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              UTI — Monitorización y soporte no invasivo
            </span>
          </div>
          <div className="space-y-0.5 rounded-lg border border-amber-100 p-1">
            {UPC_UTI_CRITERIA.map(c => (
              <CriterionCheckbox
                key={c.id}
                id={c.id}
                label={c.label}
                checked={draftUti.has(c.id)}
                onToggle={onToggleUti}
                accent="amber"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
        <span className="text-[10px] text-slate-400">
          {hasDraftCriteria
            ? `${draftUci.size + draftUti.size} criterio${draftUci.size + draftUti.size === 1 ? '' : 's'}`
            : 'Sin criterios (No UPC)'}
        </span>
        <div className="flex gap-1.5">
          {hasDraftCriteria && (
            <button
              onClick={onClear}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition-colors"
            >
              Limpiar
            </button>
          )}
          <button
            onClick={onSave}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold text-white bg-slate-700 hover:bg-slate-800 transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
