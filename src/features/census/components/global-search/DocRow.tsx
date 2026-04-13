/**
 * DocRow
 *
 * Renders a single clinical document row with type, date, author,
 * and a PDF download button.
 */

import React, { useCallback, useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import type { ClinicalDocSummary } from '@/features/census/components/global-search/globalSearchContracts';
import { formatDateToCL } from '@/utils/clinicalUtils';

interface DocRowProps {
  doc: ClinicalDocSummary;
  onDownloadPdf: (docId: string, docType: string) => Promise<void>;
}

/** Capitalises the first letter of a document type label. */
const capitalizeDocType = (type: string): string => type.charAt(0).toUpperCase() + type.slice(1);

export const DocRow: React.FC<DocRowProps> = ({ doc, onDownloadPdf }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      await onDownloadPdf(doc.id, doc.documentType);
    } finally {
      setIsDownloading(false);
    }
  }, [doc.id, doc.documentType, onDownloadPdf]);

  const dateDisplay = doc.updatedAt ? formatDateToCL(doc.updatedAt.split('T')[0]) : '';

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <FileText size={12} className="text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-slate-700 block truncate">
          {capitalizeDocType(doc.documentType)}
        </span>
        <span className="text-[10px] text-slate-400">
          {dateDisplay}
          {doc.createdBy ? ` · ${doc.createdBy}` : ''}
        </span>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors disabled:opacity-50"
        title="Descargar PDF"
      >
        {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      </button>
    </div>
  );
};
