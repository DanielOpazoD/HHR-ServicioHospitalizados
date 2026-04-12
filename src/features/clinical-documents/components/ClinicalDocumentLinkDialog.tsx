/**
 * ClinicalDocumentLinkDialog
 *
 * Compact popover for inserting a hyperlink into the clinical
 * document rich-text editor.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';

import {
  buildClinicalDocumentLinkHtml,
  validateLinkConfig,
} from '@/features/clinical-documents/controllers/clinicalDocumentLinkController';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for {@link ClinicalDocumentLinkDialog}. */
interface ClinicalDocumentLinkDialogProps {
  /** Called with the generated `<a>` HTML to insert. */
  onInsert: (html: string) => void;
  /** Closes the dialog without inserting. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pre-filled URL protocol hint shown when the dialog opens. */
const DEFAULT_URL_VALUE = 'https://';

/**
 * Minimum URL length before inline validation errors become visible.
 * Avoids flashing errors while the user is still typing the protocol.
 */
const SHOW_ERROR_MIN_LENGTH = 8;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Popover dialog for inserting a hyperlink into the clinical document editor. */
export const ClinicalDocumentLinkDialog: React.FC<ClinicalDocumentLinkDialogProps> = ({
  onInsert,
  onClose,
}) => {
  const [url, setUrl] = useState(DEFAULT_URL_VALUE);
  const [text, setText] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);

  const validationError = validateLinkConfig({ url, text });

  const handleInsert = useCallback(() => {
    if (validationError) return;
    const html = buildClinicalDocumentLinkHtml({ url, text });
    onInsert(html);
    onClose();
  }, [url, text, validationError, onInsert, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !validationError) {
        e.preventDefault();
        handleInsert();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleInsert, validationError, onClose]
  );

  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 w-64 rounded-lg border border-slate-200 bg-white shadow-lg p-3 space-y-2.5 print:hidden"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 text-slate-700">
        <Link2 size={14} />
        <span className="text-xs font-semibold">Insertar enlace</span>
      </div>

      {/* URL field */}
      <div>
        <label className="block text-[10px] text-slate-500 mb-0.5" htmlFor="link-url">
          URL
        </label>
        <input
          ref={urlInputRef}
          id="link-url"
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://ejemplo.com"
          className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder:text-slate-300 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
          autoFocus
        />
      </div>

      {/* Text field */}
      <div>
        <label className="block text-[10px] text-slate-500 mb-0.5" htmlFor="link-text">
          Texto visible <span className="text-slate-400">(opcional)</span>
        </label>
        <input
          id="link-text"
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Guía clínica MINSAL"
          className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder:text-slate-300 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
        />
      </div>

      {/* Validation error */}
      {validationError && url.length > SHOW_ERROR_MIN_LENGTH && (
        <p className="text-[10px] text-red-500">{validationError}</p>
      )}

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
