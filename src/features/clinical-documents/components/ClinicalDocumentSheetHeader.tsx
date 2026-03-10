import React from 'react';

import { CLINICAL_DOCUMENT_BRANDING } from '@/features/clinical-documents/domain/branding';
import { InlineEditableTitle } from '@/features/clinical-documents/components/InlineEditableTitle';

interface ClinicalDocumentSheetHeaderProps {
  title: string;
  canEdit: boolean;
  isLocked: boolean;
  onChangeTitle: (title: string) => void;
}

export const ClinicalDocumentSheetHeader: React.FC<ClinicalDocumentSheetHeaderProps> = ({
  title,
  canEdit,
  isLocked,
  onChangeTitle,
}) => (
  <div className="clinical-document-sheet-header">
    <img
      src={CLINICAL_DOCUMENT_BRANDING.leftLogoUrl}
      alt="Logo institucional izquierdo"
      className="clinical-document-sheet-logo"
    />
    <div className="clinical-document-title-wrap">
      <InlineEditableTitle
        value={title}
        onChange={onChangeTitle}
        disabled={!canEdit || isLocked}
        className="clinical-document-title"
      />
    </div>
    <img
      src={CLINICAL_DOCUMENT_BRANDING.rightLogoUrl}
      alt="Logo institucional derecho"
      className="clinical-document-sheet-logo justify-self-end"
    />
  </div>
);
