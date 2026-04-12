/**
 * ClinicalDocumentAnnexPage
 *
 * Annexes section rendered inside the clinical document sheet.
 * Uses CSS page-break-before so it prints as a separate page.
 * Supports images, tables, and rich text via the standard editor.
 */

import React from 'react';
import { Paperclip } from 'lucide-react';
import { ClinicalDocumentRichTextEditor } from '@/features/clinical-documents/components/ClinicalDocumentRichTextEditor';
import type { ClinicalDocumentRichTextEditorActivationApi } from '@/features/clinical-documents/hooks/useClinicalDocumentRichTextEditorController';

interface ClinicalDocumentAnnexPageProps {
  content: string;
  canEdit: boolean;
  isLocked: boolean;
  onChange: (content: string) => void;
  onEditorActivate?: (
    sectionId: string,
    editor: ClinicalDocumentRichTextEditorActivationApi
  ) => void;
  onEditorDeactivate?: (sectionId: string) => void;
}

export const ClinicalDocumentAnnexPage: React.FC<ClinicalDocumentAnnexPageProps> = ({
  content,
  canEdit,
  isLocked,
  onChange,
  onEditorActivate,
  onEditorDeactivate,
}) => (
  <div
    className="clinical-document-annex-page"
    style={{
      pageBreakBefore: 'always',
      marginTop: '24px',
      paddingTop: '16px',
      borderTop: '2px solid #e2e8f0',
    }}
  >
    <div className="flex items-center gap-2 mb-3">
      <Paperclip size={16} className="text-slate-400 print:hidden" />
      <h2 className="text-base font-bold text-slate-700">Anexos</h2>
    </div>
    <ClinicalDocumentRichTextEditor
      sectionId="annexes"
      sectionTitle="Anexos"
      value={content}
      disabled={!canEdit || isLocked}
      onChange={onChange}
      onActivate={onEditorActivate}
      onDeactivate={onEditorDeactivate}
    />
  </div>
);
