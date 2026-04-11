import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';

import { ClinicalDocumentTemplateCard } from '@/features/admin/components/components/ClinicalDocumentTemplateCard';
import {
  addClinicalDocumentTemplateField,
  addClinicalDocumentTemplateSection,
  patchClinicalDocumentTemplate,
  patchClinicalDocumentTemplateField,
  patchClinicalDocumentTemplateSection,
  removeClinicalDocumentTemplateField,
  removeClinicalDocumentTemplateSection,
  replaceSavedClinicalDocumentTemplate,
} from '@/features/admin/components/clinicalDocumentTemplatesManagerState';
import type {
  ClinicalDocumentPatientFieldTemplate,
  ClinicalDocumentSectionTemplate,
  ClinicalDocumentTemplate,
} from '@/features/clinical-documents';
import { normalizeTemplateForSave } from '@/features/clinical-documents';
import { ClinicalDocumentTemplateRepository } from '@/services/repositories/ClinicalDocumentTemplateRepository';

export const ClinicalDocumentTemplatesManager: React.FC = () => {
  const [templates, setTemplates] = useState<ClinicalDocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const data = await ClinicalDocumentTemplateRepository.listAll();
      if (mounted) {
        setTemplates(data);
        setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const patchTemplate = (templateId: string, patch: Partial<ClinicalDocumentTemplate>) => {
    setTemplates(prev => patchClinicalDocumentTemplate(prev, templateId, patch));
  };

  const patchTemplateField = (
    templateId: string,
    fieldId: string,
    patch: Partial<ClinicalDocumentPatientFieldTemplate>
  ) => {
    setTemplates(prev => patchClinicalDocumentTemplateField(prev, templateId, fieldId, patch));
  };

  const patchTemplateSection = (
    templateId: string,
    sectionId: string,
    patch: Partial<ClinicalDocumentSectionTemplate>
  ) => {
    setTemplates(prev => patchClinicalDocumentTemplateSection(prev, templateId, sectionId, patch));
  };

  const addTemplateField = (templateId: string) => {
    setTemplates(prev => addClinicalDocumentTemplateField(prev, templateId));
  };

  const removeTemplateField = (templateId: string, fieldId: string) => {
    setTemplates(prev => removeClinicalDocumentTemplateField(prev, templateId, fieldId));
  };

  const addTemplateSection = (templateId: string) => {
    setTemplates(prev => addClinicalDocumentTemplateSection(prev, templateId));
  };

  const removeTemplateSection = (templateId: string, sectionId: string) => {
    setTemplates(prev => removeClinicalDocumentTemplateSection(prev, templateId, sectionId));
  };

  const saveTemplate = async (template: ClinicalDocumentTemplate) => {
    const normalized = normalizeTemplateForSave(template);
    setSavingId(template.id);
    try {
      await ClinicalDocumentTemplateRepository.save(normalized);
      setTemplates(prev => replaceSavedClinicalDocumentTemplate(prev, normalized));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Cargando plantillas clínicas...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-medical-50 text-medical-600">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800">Plantillas Clínicas</h3>
            <p className="text-xs text-slate-500">
              Administra metadatos, campos de cabecera y secciones clínicas en Firestore.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {templates.map(template => (
          <ClinicalDocumentTemplateCard
            key={template.id}
            template={template}
            isSaving={savingId === template.id}
            onPatchTemplate={patchTemplate}
            onPatchField={patchTemplateField}
            onPatchSection={patchTemplateSection}
            onAddField={addTemplateField}
            onRemoveField={removeTemplateField}
            onAddSection={addTemplateSection}
            onRemoveSection={removeTemplateSection}
            onSave={saveTemplate}
          />
        ))}
      </div>
    </div>
  );
};
