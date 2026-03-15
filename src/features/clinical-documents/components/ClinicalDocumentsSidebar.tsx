import React from 'react';
import { FilePlus2, Trash2 } from 'lucide-react';
import clsx from 'clsx';

import { getClinicalDocumentTypeLabel } from '@/features/clinical-documents/controllers/clinicalDocumentTemplateController';
import { formatClinicalDocumentDateTime } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import type { ClinicalDocumentsSidebarProps } from '@/features/clinical-documents/contracts/clinicalDocumentsSidebarContracts';
import {
  getClinicalDocumentStatusClassName,
  getClinicalDocumentStatusLabel,
} from '@/shared/clinical-documents/clinicalDocumentPresentation';

export const ClinicalDocumentsSidebar: React.FC<ClinicalDocumentsSidebarProps> = ({
  canEdit,
  canDelete,
  patientName,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onCreateDocument,
  documents,
  selectedDocumentId,
  onSelectDocument,
  onDeleteDocument,
}) => {
  return (
    <aside className="border-r border-slate-200 bg-slate-50/70 p-3 space-y-3">
      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
          Nuevo documento
        </p>
        {!canEdit && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Perfil en solo lectura: puedes revisar e imprimir, pero no crear nuevos documentos.
          </div>
        )}
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Tipo de documento
            </span>
            <select
              value={selectedTemplateId}
              onChange={event => onSelectTemplate(event.target.value)}
              className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 text-sm text-slate-800"
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
              'w-full rounded-lg border px-2.5 py-2 text-[11px] font-black uppercase tracking-wider transition-all',
              canEdit && patientName
                ? 'border-medical-300 bg-medical-50 text-medical-800 hover:bg-medical-100'
                : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            <FilePlus2 size={14} className="inline mr-2" />
            Crear documento
          </button>
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
          <div className="space-y-2">
            {documents.map(document => (
              <div
                key={document.id}
                className={clsx(
                  'rounded-lg border bg-white px-2.5 py-2.5 transition-all',
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
                    <span className="text-[13px] font-bold text-slate-800">{document.title}</span>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {getClinicalDocumentTypeLabel(document.documentType)}
                    </p>
                  </button>
                  <div className="flex items-center gap-1">
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                        getClinicalDocumentStatusClassName(document.status)
                      )}
                    >
                      {getClinicalDocumentStatusLabel(document.status)}
                    </span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDeleteDocument(document)}
                        className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50"
                        title="Eliminar documento"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {document.audit.updatedBy.displayName || 'Sin autor'} ·{' '}
                  {formatClinicalDocumentDateTime(document.audit.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
