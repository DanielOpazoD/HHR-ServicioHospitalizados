import React from 'react';

import { InlineEditableTitle } from '@/features/clinical-documents/components/InlineEditableTitle';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';

interface ClinicalDocumentFooterSectionProps {
  document: ClinicalDocumentRecord;
  canEdit: boolean;
  onPatchFooterLabel: (kind: 'medico' | 'especialidad', title: string) => void;
  onPatchDocumentMeta: (
    patch: Partial<Pick<ClinicalDocumentRecord, 'medico' | 'especialidad'>>
  ) => void;
  onClearActiveTitleTarget: () => void;
}

export const ClinicalDocumentFooterSection: React.FC<ClinicalDocumentFooterSectionProps> = ({
  document,
  canEdit,
  onPatchFooterLabel,
  onPatchDocumentMeta,
  onClearActiveTitleTarget,
}) => (
  <div className="clinical-document-footer">
    <div className="flex flex-col gap-1">
      <InlineEditableTitle
        value={document.footerMedicoLabel}
        onChange={title => onPatchFooterLabel('medico', title)}
        onDeactivate={onClearActiveTitleTarget}
        disabled={!canEdit || document.isLocked}
        className="clinical-document-section-title"
      />
      <input
        type="text"
        value={document.medico}
        onChange={event => onPatchDocumentMeta({ medico: event.target.value })}
        readOnly={!canEdit || document.isLocked}
        className="clinical-document-input"
      />
    </div>
    <div className="flex flex-col gap-1">
      <InlineEditableTitle
        value={document.footerEspecialidadLabel}
        onChange={title => onPatchFooterLabel('especialidad', title)}
        onDeactivate={onClearActiveTitleTarget}
        disabled={!canEdit || document.isLocked}
        className="clinical-document-section-title"
      />
      <input
        type="text"
        value={document.especialidad}
        onChange={event => onPatchDocumentMeta({ especialidad: event.target.value })}
        readOnly={!canEdit || document.isLocked}
        className="clinical-document-input"
      />
    </div>
  </div>
);
