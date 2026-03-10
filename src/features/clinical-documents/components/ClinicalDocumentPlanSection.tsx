import React from 'react';

import {
  CLINICAL_DOCUMENT_PLAN_SUBSECTIONS,
  appendClinicalDocumentPlanSubsectionText,
  parseClinicalDocumentPlanSectionContent,
  updateClinicalDocumentPlanSubsectionContent,
} from '@/features/clinical-documents/controllers/clinicalDocumentPlanSectionController';
import { ClinicalDocumentIndicationsPanel } from '@/features/clinical-documents/components/ClinicalDocumentIndicationsPanel';
import { ClinicalDocumentRichTextEditor } from '@/features/clinical-documents/components/ClinicalDocumentRichTextEditor';
import type { ClinicalDocumentSpecialSectionRendererProps } from '@/features/clinical-documents/components/clinicalDocumentSheetShared';

export const ClinicalDocumentPlanSection: React.FC<ClinicalDocumentSpecialSectionRendererProps> = ({
  document,
  section,
  canEdit,
  activePlanSubsectionId,
  setActivePlanSubsectionId,
  onPatchSection,
  onEditorActivate,
  onEditorDeactivate,
  indicationsCatalog,
  isSavingCustomIndication,
  customIndicationError,
  activeIndicationsSpecialtyId,
  setActiveIndicationsSpecialtyId,
  isIndicationsPanelOpen,
  onToggleIndicationsPanel,
  addCustomIndication,
  updateIndication,
  deleteIndication,
}) => {
  const parsedPlanContent = parseClinicalDocumentPlanSectionContent(section.content);

  return (
    <>
      <ClinicalDocumentIndicationsPanel
        isOpen={isIndicationsPanelOpen}
        canEdit={canEdit && !document.isLocked}
        activeSpecialtyId={activeIndicationsSpecialtyId}
        catalog={indicationsCatalog}
        isSavingCustomIndication={isSavingCustomIndication}
        customIndicationError={customIndicationError}
        onToggle={onToggleIndicationsPanel}
        onSelectSpecialty={setActiveIndicationsSpecialtyId}
        onInsertIndication={text =>
          onPatchSection(
            section.id,
            appendClinicalDocumentPlanSubsectionText(section.content, activePlanSubsectionId, text)
          )
        }
        onAddCustomIndication={addCustomIndication}
        onUpdateIndication={updateIndication}
        onDeleteIndication={deleteIndication}
      />

      <div className="clinical-document-plan-subsections-shell">
        <div className="clinical-document-plan-subsections">
          {CLINICAL_DOCUMENT_PLAN_SUBSECTIONS.map(subsection => (
            <div key={subsection.id} className="clinical-document-plan-subsection">
              <div className="clinical-document-plan-subsection-title">{subsection.title}</div>
              <ClinicalDocumentRichTextEditor
                sectionId={`${section.id}:${subsection.id}`}
                sectionTitle={subsection.title}
                value={parsedPlanContent[subsection.id]}
                onChange={content =>
                  onPatchSection(
                    section.id,
                    updateClinicalDocumentPlanSubsectionContent(
                      section.content,
                      subsection.id,
                      content
                    )
                  )
                }
                onActivate={(activeSectionId, editorApi) => {
                  setActivePlanSubsectionId(subsection.id);
                  onEditorActivate(activeSectionId, editorApi);
                }}
                onDeactivate={onEditorDeactivate}
                disabled={!canEdit || document.isLocked}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
