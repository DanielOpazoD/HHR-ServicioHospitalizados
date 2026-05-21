import React, { useRef } from 'react';
import { File, FileText, Image, Paperclip, Trash2, Upload } from 'lucide-react';

import type { ClinicalAttachmentRecord } from '@/features/clinical-documents/domain/entities';
import { formatClinicalDocumentDateTime } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';

interface ClinicalAttachmentsPanelProps {
  canEdit: boolean;
  attachments: ClinicalAttachmentRecord[];
  patientAttachments: ClinicalAttachmentRecord[];
  isLoading: boolean;
  isLoadingPatientAttachments: boolean;
  isUploading: boolean;
  uploadStatusMessage: string | null;
  onUploadAttachment: (file: File) => Promise<void> | void;
  onDeleteAttachment: (attachment: ClinicalAttachmentRecord) => Promise<void> | void;
}

const formatAttachmentSize = (sizeBytes: number): string => {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.ceil(sizeBytes / 1024)} KB`;
};

const resolveAttachmentIcon = (attachment: ClinicalAttachmentRecord) => {
  if (attachment.fileKind === 'image') return <Image size={14} />;
  if (attachment.fileKind === 'pdf' || attachment.fileKind === 'docx')
    return <FileText size={14} />;
  return <File size={14} />;
};

const AttachmentRow: React.FC<{
  attachment: ClinicalAttachmentRecord;
  canEdit: boolean;
  onDeleteAttachment: (attachment: ClinicalAttachmentRecord) => Promise<void> | void;
}> = ({ attachment, canEdit, onDeleteAttachment }) => (
  <li className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
    <span className="text-slate-500">{resolveAttachmentIcon(attachment)}</span>
    <a
      href={attachment.downloadUrl}
      target="_blank"
      rel="noreferrer"
      className="min-w-0 flex-1 text-xs font-semibold text-slate-700 hover:text-medical-700"
    >
      <span className="block truncate">{attachment.displayName}</span>
      <span className="block text-[10px] font-normal text-slate-400">
        {formatAttachmentSize(attachment.sizeBytes)} ·{' '}
        {formatClinicalDocumentDateTime(attachment.createdAt)}
      </span>
    </a>
    {canEdit && (
      <button
        type="button"
        onClick={() => void onDeleteAttachment(attachment)}
        aria-label={`Eliminar ${attachment.displayName}`}
        title="Eliminar adjunto"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={13} />
      </button>
    )}
  </li>
);

export const ClinicalAttachmentsPanel: React.FC<ClinicalAttachmentsPanelProps> = ({
  canEdit,
  attachments,
  patientAttachments,
  isLoading,
  isLoadingPatientAttachments,
  isUploading,
  uploadStatusMessage,
  onUploadAttachment,
  onDeleteAttachment,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentEpisodeKeys = new Set(attachments.map(attachment => attachment.episodeKey));
  const otherEpisodeAttachments = patientAttachments.filter(
    attachment => !currentEpisodeKeys.has(attachment.episodeKey)
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void onUploadAttachment(file);
  };

  return (
    <section className="clinical-document-attachments-panel rounded-lg border border-slate-200 bg-slate-50/80 p-3 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip size={15} className="text-slate-500" />
          <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">
            Anexos y archivos
          </h2>
        </div>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              aria-label="Adjuntar archivo clinico"
              accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex h-7 items-center rounded-md border border-medical-200 bg-white px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-medical-700 transition-colors hover:bg-medical-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload size={12} className="mr-1" />
              Adjuntar
            </button>
          </>
        )}
      </div>

      {isUploading && (
        <p className="mt-2 text-xs text-medical-700">
          {uploadStatusMessage || 'Subiendo adjunto...'}
        </p>
      )}
      {isLoading && <p className="mt-2 text-xs text-slate-500">Cargando adjuntos...</p>}

      {!isLoading && attachments.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Sin adjuntos clinicos en esta hospitalizacion.
        </p>
      )}

      {attachments.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {attachments.map(attachment => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              canEdit={canEdit}
              onDeleteAttachment={onDeleteAttachment}
            />
          ))}
        </ul>
      )}

      {(isLoadingPatientAttachments || otherEpisodeAttachments.length > 0) && (
        <div className="mt-3 border-t border-slate-200 pt-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            Visión paciente
          </h3>
          {isLoadingPatientAttachments && (
            <p className="mt-1 text-xs text-slate-500">Cargando anexos del paciente...</p>
          )}
          {!isLoadingPatientAttachments && otherEpisodeAttachments.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {otherEpisodeAttachments.map(attachment => (
                <AttachmentRow
                  key={attachment.id}
                  attachment={attachment}
                  canEdit={canEdit}
                  onDeleteAttachment={onDeleteAttachment}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
