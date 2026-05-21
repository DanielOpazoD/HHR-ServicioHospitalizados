import React, { useRef, useState } from 'react';
import {
  Check,
  File,
  FileText,
  FolderOpen,
  Image,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import type { ClinicalAttachmentRecord } from '@/features/clinical-documents/domain/entities';
import { formatClinicalDocumentDateTime } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';

interface ClinicalAttachmentsPanelProps {
  canEdit: boolean;
  currentDocumentId?: string | null;
  attachments: ClinicalAttachmentRecord[];
  patientAttachments: ClinicalAttachmentRecord[];
  isLoading: boolean;
  isLoadingPatientAttachments: boolean;
  isUploading: boolean;
  uploadStatusMessage: string | null;
  onUploadAttachment: (file: File) => Promise<void> | void;
  onDeleteAttachment: (attachment: ClinicalAttachmentRecord) => Promise<void> | void;
  onRenameAttachment: (
    attachment: ClinicalAttachmentRecord,
    displayName: string
  ) => Promise<void> | void;
  onSuggestAttachmentName: (attachment: ClinicalAttachmentRecord) => Promise<string | null>;
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
  scopeLabel?: string;
  onDeleteAttachment: (attachment: ClinicalAttachmentRecord) => Promise<void> | void;
  onRenameAttachment: (
    attachment: ClinicalAttachmentRecord,
    displayName: string
  ) => Promise<void> | void;
  onSuggestAttachmentName: (attachment: ClinicalAttachmentRecord) => Promise<string | null>;
}> = ({
  attachment,
  canEdit,
  scopeLabel,
  onDeleteAttachment,
  onRenameAttachment,
  onSuggestAttachmentName,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(attachment.displayName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleStartEditing = () => {
    setDraftName(attachment.displayName);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setDraftName(attachment.displayName);
    setIsEditing(false);
  };

  const handleSaveName = async () => {
    const nextName = draftName.trim();
    if (!nextName || nextName === attachment.displayName) {
      setIsEditing(false);
      return;
    }
    setIsRenaming(true);
    try {
      await onRenameAttachment(attachment, nextName);
      setIsEditing(false);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleSuggestName = async () => {
    setIsSuggesting(true);
    try {
      const suggestedName = await onSuggestAttachmentName(attachment);
      if (suggestedName) {
        setDraftName(suggestedName);
      }
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <li className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <span className="text-slate-500">{resolveAttachmentIcon(attachment)}</span>
      {isEditing ? (
        <div className="min-w-0 flex-1">
          <input
            type="text"
            aria-label="Nombre visible del adjunto"
            value={draftName}
            onChange={event => setDraftName(event.target.value)}
            className="h-7 w-full rounded-md border border-medical-200 px-2 text-xs font-semibold text-slate-700 outline-none focus:border-medical-500"
          />
          <span className="mt-0.5 block text-[10px] text-slate-400">
            {scopeLabel ? `${scopeLabel} · ` : ''}
            {formatAttachmentSize(attachment.sizeBytes)} ·{' '}
            {formatClinicalDocumentDateTime(attachment.createdAt)}
          </span>
        </div>
      ) : (
        <a
          href={attachment.downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 text-xs font-semibold text-slate-700 hover:text-medical-700"
        >
          <span className="block truncate">{attachment.displayName}</span>
          <span className="block text-[10px] font-normal text-slate-400">
            {scopeLabel ? `${scopeLabel} · ` : ''}
            {formatAttachmentSize(attachment.sizeBytes)} ·{' '}
            {formatClinicalDocumentDateTime(attachment.createdAt)}
          </span>
        </a>
      )}
      {canEdit && (
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => void handleSuggestName()}
                disabled={isSuggesting || isRenaming}
                aria-label="Sugerir nombre con IA"
                title="Sugerir nombre con IA"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-violet-500 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSuggesting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveName()}
                disabled={isRenaming || !draftName.trim()}
                aria-label="Guardar nombre"
                title="Guardar nombre"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRenaming ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button
                type="button"
                onClick={handleCancelEditing}
                disabled={isRenaming}
                aria-label="Cancelar renombrar"
                title="Cancelar"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleStartEditing}
              aria-label={`Renombrar ${attachment.displayName}`}
              title="Renombrar adjunto"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-medical-50 hover:text-medical-700"
            >
              <Pencil size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => void onDeleteAttachment(attachment)}
            aria-label={`Eliminar ${attachment.displayName}`}
            title="Eliminar adjunto"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </li>
  );
};

const ClinicalAttachmentSection: React.FC<{
  title: string;
  description: string;
  emptyMessage?: string;
  attachments: ClinicalAttachmentRecord[];
  canEdit: boolean;
  scopeLabel: string | ((attachment: ClinicalAttachmentRecord) => string);
  onDeleteAttachment: (attachment: ClinicalAttachmentRecord) => Promise<void> | void;
  onRenameAttachment: (
    attachment: ClinicalAttachmentRecord,
    displayName: string
  ) => Promise<void> | void;
  onSuggestAttachmentName: (attachment: ClinicalAttachmentRecord) => Promise<string | null>;
}> = ({
  title,
  description,
  emptyMessage,
  attachments,
  canEdit,
  scopeLabel,
  onDeleteAttachment,
  onRenameAttachment,
  onSuggestAttachmentName,
}) => (
  <div className="mt-3 first:mt-2">
    <div>
      <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">{title}</h3>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{description}</p>
    </div>
    {attachments.length > 0 ? (
      <ul className="mt-2 space-y-1.5">
        {attachments.map(attachment => (
          <AttachmentRow
            key={attachment.id}
            attachment={attachment}
            canEdit={canEdit}
            scopeLabel={typeof scopeLabel === 'function' ? scopeLabel(attachment) : scopeLabel}
            onDeleteAttachment={onDeleteAttachment}
            onRenameAttachment={onRenameAttachment}
            onSuggestAttachmentName={onSuggestAttachmentName}
          />
        ))}
      </ul>
    ) : emptyMessage ? (
      <p className="mt-2 text-xs text-slate-500">{emptyMessage}</p>
    ) : null}
  </div>
);

export const ClinicalAttachmentsPanel: React.FC<ClinicalAttachmentsPanelProps> = ({
  canEdit,
  currentDocumentId,
  attachments,
  patientAttachments,
  isLoading,
  isLoadingPatientAttachments,
  isUploading,
  uploadStatusMessage,
  onUploadAttachment,
  onDeleteAttachment,
  onRenameAttachment,
  onSuggestAttachmentName,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentEpisodeKeys = new Set(attachments.map(attachment => attachment.episodeKey));
  const otherEpisodeAttachments = patientAttachments.filter(
    attachment => !currentEpisodeKeys.has(attachment.episodeKey)
  );
  const resolveEpisodeScopeLabel = (attachment: ClinicalAttachmentRecord): string =>
    currentDocumentId && attachment.documentId === currentDocumentId
      ? 'Vinculado al documento'
      : 'Archivo del episodio';

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
          <FolderOpen size={15} className="text-slate-500" />
          <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">
            Archivos del episodio
          </h2>
        </div>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              aria-label="Adjuntar archivo al episodio"
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
      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Disponible para todo el episodio clínico.
      </p>
      {isLoading && (
        <p className="mt-2 text-xs text-slate-500">Cargando archivos del episodio...</p>
      )}

      {!isLoading && (
        <ClinicalAttachmentSection
          title="Archivos disponibles"
          description="Imágenes, PDF, DOCX u otros respaldos clínicos guardados en Storage."
          emptyMessage="Sin archivos del episodio."
          attachments={attachments}
          canEdit={canEdit}
          scopeLabel={resolveEpisodeScopeLabel}
          onDeleteAttachment={onDeleteAttachment}
          onRenameAttachment={onRenameAttachment}
          onSuggestAttachmentName={onSuggestAttachmentName}
        />
      )}

      {(isLoadingPatientAttachments || otherEpisodeAttachments.length > 0) && (
        <div className="mt-3 border-t border-slate-200 pt-2">
          {isLoadingPatientAttachments && (
            <p className="mt-1 text-xs text-slate-500">Cargando otros episodios del paciente...</p>
          )}
          {!isLoadingPatientAttachments && otherEpisodeAttachments.length > 0 && (
            <ClinicalAttachmentSection
              title="Otros episodios del paciente"
              description="Archivos de otras hospitalizaciones del mismo RUT."
              attachments={otherEpisodeAttachments}
              canEdit={canEdit}
              scopeLabel="Otro episodio"
              onDeleteAttachment={onDeleteAttachment}
              onRenameAttachment={onRenameAttachment}
              onSuggestAttachmentName={onSuggestAttachmentName}
            />
          )}
        </div>
      )}
    </section>
  );
};
