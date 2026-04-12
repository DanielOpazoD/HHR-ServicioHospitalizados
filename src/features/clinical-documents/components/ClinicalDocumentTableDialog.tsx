/**
 * ClinicalDocumentTableDialog
 *
 * Compact popover that lets the user choose rows, columns, and
 * header presence before inserting an HTML table into the active
 * section editor.
 */

import React, { useCallback, useState } from 'react';
import { Minus, Plus, Table2 } from 'lucide-react';

import {
  TABLE_MAX_COLS,
  TABLE_MAX_ROWS,
  TABLE_MIN_COLS,
  TABLE_MIN_ROWS,
  buildClinicalDocumentTableHtml,
  validateTableConfig,
} from '@/features/clinical-documents/controllers/clinicalDocumentTableController';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for {@link ClinicalDocumentTableDialog}. */
interface ClinicalDocumentTableDialogProps {
  /** Called with the generated `<table>` HTML to insert. */
  onInsert: (html: string) => void;
  /** Closes the dialog without inserting. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_COLS = 3;
const DEFAULT_ROWS = 3;
const DEFAULT_HAS_HEADER = true;

// ---------------------------------------------------------------------------
// Stepper sub-component
// ---------------------------------------------------------------------------

/** Numeric stepper with +/- buttons for table dimension selection. */
interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

const Stepper: React.FC<StepperProps> = ({ label, value, min, max, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-slate-600">{label}</span>
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label={`Menos ${label.toLowerCase()}`}
      >
        <Minus size={12} />
      </button>
      <span className="w-5 text-center text-sm font-medium tabular-nums">{value}</span>
      <button
        type="button"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label={`Más ${label.toLowerCase()}`}
      >
        <Plus size={12} />
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

/** Popover dialog for configuring and inserting an HTML table. */
export const ClinicalDocumentTableDialog: React.FC<ClinicalDocumentTableDialogProps> = ({
  onInsert,
  onClose,
}) => {
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [hasHeader, setHasHeader] = useState(DEFAULT_HAS_HEADER);

  const validationError = validateTableConfig({ cols, rows, hasHeader });

  const handleInsert = useCallback(() => {
    if (validationError) return;
    const html = buildClinicalDocumentTableHtml({ cols, rows, hasHeader });
    onInsert(html);
    onClose();
  }, [cols, rows, hasHeader, validationError, onInsert, onClose]);

  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-52 rounded-lg border border-slate-200 bg-white shadow-lg p-3 space-y-3 print:hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-slate-700">
        <Table2 size={14} />
        <span className="text-xs font-semibold">Insertar tabla</span>
      </div>

      {/* Grid config */}
      <div className="space-y-2">
        <Stepper
          label="Columnas"
          value={cols}
          min={TABLE_MIN_COLS}
          max={TABLE_MAX_COLS}
          onChange={setCols}
        />
        <Stepper
          label="Filas"
          value={rows}
          min={TABLE_MIN_ROWS}
          max={TABLE_MAX_ROWS}
          onChange={setRows}
        />
      </div>

      {/* Header toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={hasHeader}
          onChange={e => setHasHeader(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        />
        <span className="text-xs text-slate-600">Fila de encabezado</span>
      </label>

      {/* Preview hint */}
      <div className="text-[10px] text-slate-400 text-center">
        {cols} × {rows} {hasHeader ? '(con encabezado)' : ''}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleInsert}
          disabled={!!validationError}
          className="flex-1 rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
        >
          Insertar
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
