import React from 'react';
import { EyeOff, FileSignature } from 'lucide-react';

import { InlineEditableTitle } from '@/features/clinical-documents/components/InlineEditableTitle';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';

interface ClinicalDocumentFooterSectionProps {
  document: ClinicalDocumentRecord;
  canEdit: boolean;
  onPatchFooterLabel: (kind: 'medico' | 'especialidad', title: string) => void;
  onPatchDocumentMeta: (
    patch: Partial<
      Pick<ClinicalDocumentRecord, 'medico' | 'especialidad' | 'includePatientSignature'>
    >
  ) => void;
  onClearActiveTitleTarget: () => void;
}

const DOCUMENT_TYPES_WITH_PATIENT_SIGNATURE = new Set<ClinicalDocumentRecord['documentType']>([
  'epicrisis',
  'epicrisis_traslado',
]);

export const ClinicalDocumentFooterSection: React.FC<ClinicalDocumentFooterSectionProps> = ({
  document,
  canEdit,
  onPatchFooterLabel,
  onPatchDocumentMeta,
  onClearActiveTitleTarget,
}) => {
  const includePatientSignature = document.includePatientSignature ?? true;
  const canChangePatientSignature = canEdit && !document.isLocked;
  const showsPatientSignatureControl = DOCUMENT_TYPES_WITH_PATIENT_SIGNATURE.has(
    document.documentType
  );
  const signatureToggleLabel = includePatientSignature ? 'Firma visible' : 'Firma oculta';
  const signatureToggleActionLabel = includePatientSignature
    ? 'Ocultar firma paciente/familiar'
    : 'Mostrar firma paciente/familiar';
  const signatureToggleClassName = [
    'clinical-document-print-control inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[9px] font-medium transition-colors print:hidden disabled:cursor-not-allowed disabled:opacity-50',
    includePatientSignature
      ? 'border-slate-200 bg-white/70 text-slate-400 hover:border-slate-300 hover:text-slate-600'
      : 'border-amber-200 bg-amber-50/80 text-amber-700 hover:border-amber-300 hover:text-amber-800',
  ].join(' ');

  return (
    <div className="clinical-document-footer">
      {showsPatientSignatureControl ? (
        <div className="col-span-2 flex justify-end print:hidden">
          <button
            type="button"
            aria-pressed={!includePatientSignature}
            aria-label={signatureToggleActionLabel}
            title={signatureToggleActionLabel}
            disabled={!canChangePatientSignature}
            onClick={() =>
              onPatchDocumentMeta({ includePatientSignature: !includePatientSignature })
            }
            className={signatureToggleClassName}
          >
            {includePatientSignature ? <FileSignature size={11} /> : <EyeOff size={11} />}
            {signatureToggleLabel}
          </button>
        </div>
      ) : null}
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
};
