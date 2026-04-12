import React, { useState } from 'react';
import { FilePlus2, FlaskConical, History, Paperclip, PenLine, Trash2 } from 'lucide-react';
import clsx from 'clsx';

import { getClinicalDocumentTypeLabel } from '@/features/clinical-documents/controllers/clinicalDocumentTemplateController';
import {
  formatClinicalDocumentAuthorName,
  formatClinicalDocumentDateTime,
} from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import type { ClinicalDocumentsSidebarProps } from '@/features/clinical-documents/contracts/clinicalDocumentsSidebarContracts';
import type { ClinicalDocumentVersionMeta } from '@/features/clinical-documents/domain/entities';
import { ClinicalDocumentVersionHistory } from '@/features/clinical-documents/components/ClinicalDocumentVersionHistory';

const VersionBadge: React.FC<{
  currentVersion: number;
  versionHistory: ClinicalDocumentVersionMeta[];
}> = ({ currentVersion, versionHistory }) => {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setShowHistory(true);
        }}
        className="flex items-center gap-0.5 text-[9px] font-mono text-slate-400 hover:text-medical-600 transition-colors"
        title="Ver historial de versiones"
      >
        <History size={9} />v{currentVersion}
      </button>
      {showHistory && (
        <ClinicalDocumentVersionHistory
          versions={versionHistory}
          currentVersion={currentVersion}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
};

export const ClinicalDocumentsSidebar: React.FC<ClinicalDocumentsSidebarProps> = ({
  canEdit,
  canDelete,
  readOnlyMessage,
  patientName,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onCreateDocument,
  documents,
  selectedDocumentId,
  onSelectDocument,
  onDeleteDocument,
  onAddClinicalUpdate,
  onToggleAnnex,
  hasAnnex,
  patientRut,
  onOpenLabDialog,
}) => {
  return (
    <aside className="space-y-2.5 border-r border-slate-200 bg-slate-50/70 p-2.5">
      {/* Patient context + LAB shortcut */}
      {patientName && (
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-slate-800 leading-tight truncate">
              {patientName}
            </p>
            {patientRut && (
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{patientRut}</p>
            )}
          </div>
          {onOpenLabDialog && (
            <button
              type="button"
              onClick={onOpenLabDialog}
              className="shrink-0 inline-flex h-7 items-center rounded-md border border-emerald-200 px-2 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700 hover:bg-emerald-50 transition-colors"
              title="Insertar resumen de laboratorio"
            >
              <FlaskConical size={11} className="mr-1" />
              Lab
            </button>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {readOnlyMessage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            {readOnlyMessage}
          </div>
        )}
        <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Tipo de documento
            </span>
            <select
              value={selectedTemplateId}
              onChange={event => onSelectTemplate(event.target.value)}
              className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-800"
            >
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onCreateDocument}
            disabled={!canEdit || !patientName}
            className={clsx(
              'w-full rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] transition-all',
              canEdit && patientName
                ? 'border-medical-300 bg-medical-50 text-medical-800 hover:bg-medical-100'
                : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            <FilePlus2 size={12} className="inline mr-1.5" />
            Crear
          </button>
          {selectedDocumentId && canEdit && (
            <div className="flex gap-1.5 mt-1">
              {onAddClinicalUpdate && (
                <button
                  type="button"
                  onClick={onAddClinicalUpdate}
                  className="flex-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-violet-700 hover:bg-violet-100 transition-colors"
                >
                  <PenLine size={10} className="inline mr-1" />
                  Actualización
                </button>
              )}
              {onToggleAnnex && (
                <button
                  type="button"
                  onClick={onToggleAnnex}
                  className={clsx(
                    'flex-1 rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] transition-colors',
                    hasAnnex
                      ? 'border-medical-300 bg-medical-50 text-medical-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <Paperclip size={10} className="inline mr-1" />
                  Anexo
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
          Episodio actual
        </p>
        {documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
            No hay documentos clínicos para este episodio.
          </div>
        ) : (
          <div className="space-y-1.5">
            {documents.map(document => (
              <div
                key={document.id}
                className={clsx(
                  'group/doc rounded-lg border bg-white px-2 py-1.5 transition-all',
                  selectedDocumentId === document.id
                    ? 'border-medical-300 bg-medical-50'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectDocument(document.id)}
                    className="flex-1 text-left"
                  >
                    <span className="text-[11px] font-semibold leading-tight text-slate-700">
                      {getClinicalDocumentTypeLabel(document.documentType)}
                    </span>
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteDocument(document)}
                      className="rounded-md p-[3px] text-slate-300 opacity-0 transition-all group-hover/doc:opacity-100 hover:text-red-500 hover:bg-red-50"
                      title="Eliminar documento"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                  <p className="text-[9px] text-slate-500">
                    {formatClinicalDocumentAuthorName(document.audit.updatedBy.displayName)} ·{' '}
                    {formatClinicalDocumentDateTime(document.audit.updatedAt)}
                  </p>
                  {document.versionHistory && document.versionHistory.length > 0 && (
                    <VersionBadge
                      currentVersion={document.currentVersion}
                      versionHistory={document.versionHistory}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
