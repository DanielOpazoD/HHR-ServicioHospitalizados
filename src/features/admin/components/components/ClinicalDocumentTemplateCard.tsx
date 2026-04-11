import React from 'react';
import { FilePlus2, Plus, Save, Trash2 } from 'lucide-react';

import type {
  ClinicalDocumentPatientFieldTemplate,
  ClinicalDocumentSectionTemplate,
  ClinicalDocumentTemplate,
} from '@/features/clinical-documents';

interface ClinicalDocumentTemplateCardProps {
  template: ClinicalDocumentTemplate;
  isSaving: boolean;
  onPatchTemplate: (templateId: string, patch: Partial<ClinicalDocumentTemplate>) => void;
  onPatchField: (
    templateId: string,
    fieldId: string,
    patch: Partial<ClinicalDocumentPatientFieldTemplate>
  ) => void;
  onPatchSection: (
    templateId: string,
    sectionId: string,
    patch: Partial<ClinicalDocumentSectionTemplate>
  ) => void;
  onAddField: (templateId: string) => void;
  onRemoveField: (templateId: string, fieldId: string) => void;
  onAddSection: (templateId: string) => void;
  onRemoveSection: (templateId: string, sectionId: string) => void;
  onSave: (template: ClinicalDocumentTemplate) => Promise<void>;
}

export const ClinicalDocumentTemplateCard: React.FC<ClinicalDocumentTemplateCardProps> = ({
  template,
  isSaving,
  onPatchTemplate,
  onPatchField,
  onPatchSection,
  onAddField,
  onRemoveField,
  onAddSection,
  onRemoveSection,
  onSave,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">
              Nombre
            </span>
            <input
              type="text"
              value={template.name}
              onChange={event => onPatchTemplate(template.id, { name: event.target.value })}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">
              Título
            </span>
            <input
              type="text"
              value={template.title}
              onChange={event => onPatchTemplate(template.id, { title: event.target.value })}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">
              Estado
            </span>
            <select
              value={template.status}
              onChange={event =>
                onPatchTemplate(template.id, {
                  status: event.target.value as ClinicalDocumentTemplate['status'],
                })
              }
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              <option value="active">Activa</option>
              <option value="archived">Archivada</option>
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={template.allowCustomTitle}
              onChange={event =>
                onPatchTemplate(template.id, { allowCustomTitle: event.target.checked })
              }
            />
            Título editable
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={template.allowAddSection}
              onChange={event =>
                onPatchTemplate(template.id, { allowAddSection: event.target.checked })
              }
            />
            Permitir secciones extra
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={template.allowClinicalUpdateSections}
              onChange={event =>
                onPatchTemplate(template.id, {
                  allowClinicalUpdateSections: event.target.checked,
                })
              }
            />
            Sección actualización
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              Campos de cabecera ({template.patientFields.length})
            </p>
            <button
              type="button"
              onClick={() => onAddField(template.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100"
            >
              <Plus size={12} />
              Campo
            </button>
          </div>
          <div className="space-y-2">
            {template.patientFields.map(field => (
              <div
                key={field.id}
                className="grid items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[1fr_140px_140px_70px_auto]"
              >
                <input
                  type="text"
                  value={field.label}
                  onChange={event =>
                    onPatchField(template.id, field.id, { label: event.target.value })
                  }
                  className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-800"
                />
                <input
                  type="text"
                  value={field.id}
                  onChange={event =>
                    onPatchField(template.id, field.id, { id: event.target.value })
                  }
                  className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
                />
                <select
                  value={field.type}
                  onChange={event =>
                    onPatchField(template.id, field.id, {
                      type: event.target.value as ClinicalDocumentPatientFieldTemplate['type'],
                    })
                  }
                  className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
                >
                  <option value="text">Texto</option>
                  <option value="date">Fecha</option>
                  <option value="time">Hora</option>
                  <option value="number">Número</option>
                </select>
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={Boolean(field.readonly)}
                    onChange={event =>
                      onPatchField(template.id, field.id, {
                        readonly: event.target.checked,
                      })
                    }
                  />
                  RO
                </label>
                <button
                  type="button"
                  onClick={() => onRemoveField(template.id, field.id)}
                  className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                  title="Eliminar campo"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              Secciones ({template.sections.length})
            </p>
            <button
              type="button"
              onClick={() => onAddSection(template.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100"
            >
              <FilePlus2 size={12} />
              Sección
            </button>
          </div>
          <div className="space-y-2">
            {template.sections
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((section, index) => (
                <div
                  key={section.id}
                  className="grid items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[28px_1fr_140px_80px_80px_auto]"
                >
                  <span className="text-center text-[11px] font-black text-slate-400">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={section.title}
                    onChange={event =>
                      onPatchSection(template.id, section.id, {
                        title: event.target.value,
                      })
                    }
                    className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-800"
                  />
                  <input
                    type="text"
                    value={section.id}
                    onChange={event =>
                      onPatchSection(template.id, section.id, {
                        id: event.target.value,
                      })
                    }
                    className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={section.visible !== false}
                      onChange={event =>
                        onPatchSection(template.id, section.id, {
                          visible: event.target.checked,
                        })
                      }
                    />
                    Visible
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean(section.required)}
                      onChange={event =>
                        onPatchSection(template.id, section.id, {
                          required: event.target.checked,
                        })
                      }
                    />
                    Oblig.
                  </label>
                  <button
                    type="button"
                    onClick={() => onRemoveSection(template.id, section.id)}
                    className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                    title="Eliminar sección"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="flex items-start justify-end">
        <button
          type="button"
          onClick={() => void onSave(template)}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Save size={14} />
          {isSaving ? 'Guardando' : 'Guardar'}
        </button>
      </div>
    </div>
  </div>
);
