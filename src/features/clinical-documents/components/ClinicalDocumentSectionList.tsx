import React from 'react';
import type { DragEvent } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react';

import { ClinicalDocumentIndicationsPanel } from '@/features/clinical-documents/components/ClinicalDocumentIndicationsPanel';
import { InlineEditableTitle } from '@/features/clinical-documents/components/InlineEditableTitle';
import { renderClinicalDocumentSectionContent } from '@/features/clinical-documents/components/clinicalDocumentSectionRendererRegistry';
import { appendClinicalDocumentPlanSubsectionText } from '@/features/clinical-documents/controllers/clinicalDocumentPlanSectionController';
import type {
  ClinicalDocumentSheetEditorApi,
  ClinicalDocumentSheetProps,
} from '@/features/clinical-documents/components/clinicalDocumentSheetShared';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import type { ClinicalDocumentPlanSubsectionId } from '@/features/clinical-documents/controllers/clinicalDocumentPlanSectionController';
import type { ClinicalDocumentIndicationSpecialtyId } from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';

interface ClinicalDocumentSectionListProps {
  document: ClinicalDocumentRecord;
  visibleSections: ClinicalDocumentRecord['sections'];
  canEdit: boolean;
  activeTitleTarget: string | null;
  draggedSectionId: string | null;
  dragOverSectionId: string | null;
  activePlanSubsectionId: ClinicalDocumentPlanSubsectionId;
  activeIndicationsSpecialtyId: ClinicalDocumentIndicationSpecialtyId;
  isIndicationsPanelOpen: boolean;
  indicationsCatalog: ClinicalDocumentSheetProps['indicationsCatalog'];
  isSavingCustomIndication: boolean;
  customIndicationError: string | null;
  onSetActiveTitleTarget: React.Dispatch<React.SetStateAction<string | null>>;
  onPatchSectionTitle: (sectionId: string, title: string) => void;
  onPatchSection: (sectionId: string, content: string) => void;
  onSetSectionVisibility: (sectionId: string, visible: boolean) => void;
  onMoveSection: (sectionId: string, direction: 'up' | 'down') => void;
  onReorderSection: (sourceSectionId: string, targetSectionId: string) => void;
  onEditorActivate: (activeSectionId: string, editorApi: ClinicalDocumentSheetEditorApi) => void;
  onEditorDeactivate: (sectionId: string) => void;
  onSetActivePlanSubsectionId: (subsectionId: ClinicalDocumentPlanSubsectionId) => void;
  onSetActiveIndicationsSpecialtyId: (specialtyId: ClinicalDocumentIndicationSpecialtyId) => void;
  onToggleIndicationsPanel: () => void;
  onInsertIntoActiveEditor: (text: string) => boolean;
  onAddCustomIndication: ClinicalDocumentSheetProps['addCustomIndication'];
  onUpdateIndication: ClinicalDocumentSheetProps['updateIndication'];
  onDeleteIndication: ClinicalDocumentSheetProps['deleteIndication'];
  onImportIndicationsCatalog: ClinicalDocumentSheetProps['importIndicationsCatalog'];
  dragHandlers: {
    onDragStart: (event: DragEvent<HTMLButtonElement>, sectionId: string) => void;
    onDragOver: (event: DragEvent<HTMLElement>, sectionId: string, canInteract: boolean) => void;
    onDragLeave: (sectionId: string) => void;
    onDragEnd: () => void;
  };
}

export const ClinicalDocumentSectionList: React.FC<ClinicalDocumentSectionListProps> = ({
  document,
  visibleSections,
  canEdit,
  activeTitleTarget,
  draggedSectionId,
  dragOverSectionId,
  activePlanSubsectionId,
  activeIndicationsSpecialtyId,
  isIndicationsPanelOpen,
  indicationsCatalog,
  isSavingCustomIndication,
  customIndicationError,
  onSetActiveTitleTarget,
  onPatchSectionTitle,
  onPatchSection,
  onSetSectionVisibility,
  onMoveSection,
  onReorderSection,
  onEditorActivate,
  onEditorDeactivate,
  onSetActivePlanSubsectionId,
  onSetActiveIndicationsSpecialtyId,
  onToggleIndicationsPanel,
  onInsertIntoActiveEditor,
  onAddCustomIndication,
  onUpdateIndication,
  onDeleteIndication,
  onImportIndicationsCatalog,
  dragHandlers,
}) => (
  <div className="space-y-3">
    {visibleSections.map(section => (
      <div
        key={section.id}
        className={`block clinical-document-section-block${
          dragOverSectionId === section.id ? ' is-drag-over' : ''
        }${activeTitleTarget === `section:${section.id}` ? ' is-title-active' : ''}`}
        onDragOver={event =>
          dragHandlers.onDragOver(event, section.id, canEdit && !document.isLocked)
        }
        onDragLeave={() => dragHandlers.onDragLeave(section.id)}
        onDrop={event => {
          if (!canEdit || document.isLocked) return;
          event.preventDefault();
          const sourceSectionId = event.dataTransfer.getData('text/plain') || draggedSectionId;
          if (sourceSectionId && sourceSectionId !== section.id) {
            onReorderSection(sourceSectionId, section.id);
          }
          dragHandlers.onDragEnd();
        }}
      >
        {canEdit && !document.isLocked && (
          <button
            type="button"
            className="clinical-document-section-drag-handle"
            draggable
            onDragStart={event => dragHandlers.onDragStart(event, section.id)}
            onDragEnd={dragHandlers.onDragEnd}
            aria-label={`Arrastrar sección ${section.title}`}
            title="Arrastrar sección"
          >
            <GripVertical size={14} />
          </button>
        )}
        <div className="clinical-document-section-layout">
          <div className="clinical-document-section-main">
            <div className="clinical-document-field-label-row clinical-document-section-header-row">
              <InlineEditableTitle
                value={section.title}
                onChange={title => onPatchSectionTitle(section.id, title)}
                onActivate={() => onSetActiveTitleTarget(`section:${section.id}`)}
                onDeactivate={() =>
                  onSetActiveTitleTarget(current =>
                    current === `section:${section.id}` ? null : current
                  )
                }
                disabled={!canEdit || document.isLocked}
                className="clinical-document-section-title"
              />
              {document.documentType === 'epicrisis' &&
                section.id === 'plan' &&
                !document.isLocked && (
                  <ClinicalDocumentIndicationsPanel
                    isOpen={isIndicationsPanelOpen}
                    canEdit={canEdit && !document.isLocked}
                    activeSpecialtyId={activeIndicationsSpecialtyId}
                    catalog={indicationsCatalog}
                    isSavingCustomIndication={isSavingCustomIndication}
                    customIndicationError={customIndicationError}
                    onToggle={onToggleIndicationsPanel}
                    onSelectSpecialty={onSetActiveIndicationsSpecialtyId}
                    onInsertIndication={text => {
                      if (onInsertIntoActiveEditor(text)) {
                        return;
                      }

                      onPatchSection(
                        section.id,
                        appendClinicalDocumentPlanSubsectionText(
                          section.content,
                          activePlanSubsectionId,
                          text
                        )
                      );
                    }}
                    onAddCustomIndication={onAddCustomIndication}
                    onUpdateIndication={onUpdateIndication}
                    onDeleteIndication={onDeleteIndication}
                    onImportCatalog={onImportIndicationsCatalog}
                  />
                )}
              {canEdit && !document.isLocked && activeTitleTarget === `section:${section.id}` && (
                <>
                  <button
                    type="button"
                    className="clinical-document-inline-action"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => onMoveSection(section.id, 'up')}
                    aria-label={`Subir sección ${section.title}`}
                    title="Subir sección"
                    disabled={visibleSections[0]?.id === section.id}
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    className="clinical-document-inline-action"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => onMoveSection(section.id, 'down')}
                    aria-label={`Bajar sección ${section.title}`}
                    title="Bajar sección"
                    disabled={visibleSections[visibleSections.length - 1]?.id === section.id}
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    type="button"
                    className="clinical-document-inline-action clinical-document-inline-action--danger"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => onSetSectionVisibility(section.id, false)}
                    aria-label={`Eliminar sección ${section.title}`}
                    title="Eliminar sección"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
            {renderClinicalDocumentSectionContent({
              document,
              section,
              canEdit,
              activePlanSubsectionId,
              setActivePlanSubsectionId: onSetActivePlanSubsectionId,
              onPatchSection,
              onAppendSectionText: (_sectionId, _text) => undefined,
              onEditorActivate,
              onEditorDeactivate,
              indicationsCatalog,
              isSavingCustomIndication,
              customIndicationError,
              activeIndicationsSpecialtyId,
              setActiveIndicationsSpecialtyId: onSetActiveIndicationsSpecialtyId,
              isIndicationsPanelOpen,
              onToggleIndicationsPanel,
              addCustomIndication: onAddCustomIndication,
              updateIndication: onUpdateIndication,
              deleteIndication: onDeleteIndication,
              importIndicationsCatalog: onImportIndicationsCatalog,
            })}
          </div>
        </div>
      </div>
    ))}
  </div>
);
