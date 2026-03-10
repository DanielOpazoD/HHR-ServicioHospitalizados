import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, EllipsisVertical, FileDown, FileUp, Pencil, Plus, Trash2, X } from 'lucide-react';

import type { ClinicalDocumentIndicationSpecialtyId } from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';
import type {
  ClinicalDocumentIndicationCatalogItem,
  ClinicalDocumentIndicationsCatalog,
} from '@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService';

interface ClinicalDocumentIndicationsPanelProps {
  isOpen: boolean;
  canEdit: boolean;
  activeSpecialtyId: ClinicalDocumentIndicationSpecialtyId;
  catalog: ClinicalDocumentIndicationsCatalog;
  isSavingCustomIndication: boolean;
  customIndicationError: string | null;
  onToggle: () => void;
  onSelectSpecialty: (specialtyId: ClinicalDocumentIndicationSpecialtyId) => void;
  onInsertIndication: (text: string) => void;
  onAddCustomIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    text: string
  ) => Promise<boolean>;
  onUpdateIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    itemId: string,
    text: string
  ) => Promise<boolean>;
  onDeleteIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    itemId: string
  ) => Promise<boolean>;
  onImportCatalog: (catalog: unknown) => Promise<boolean>;
}

const renderItemBadge = (item: ClinicalDocumentIndicationCatalogItem) =>
  item.source === 'custom' ? (
    <span className="clinical-document-indications-badge">Propia</span>
  ) : null;

export const ClinicalDocumentIndicationsPanel: React.FC<ClinicalDocumentIndicationsPanelProps> = ({
  isOpen,
  canEdit,
  activeSpecialtyId,
  catalog,
  isSavingCustomIndication,
  customIndicationError,
  onToggle,
  onSelectSpecialty,
  onInsertIndication,
  onAddCustomIndication,
  onUpdateIndication,
  onDeleteIndication,
  onImportCatalog,
}) => {
  const [customText, setCustomText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isTransferMenuOpen, setIsTransferMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeSpecialty = catalog.specialties[activeSpecialtyId];
  const specialtyList = useMemo(() => Object.values(catalog.specialties), [catalog.specialties]);

  const handleAddCustomIndication = async () => {
    const wasSaved = await onAddCustomIndication(activeSpecialtyId, customText);
    if (wasSaved) {
      setCustomText('');
    }
  };

  const handleStartEditing = (item: ClinicalDocumentIndicationCatalogItem) => {
    setEditingItemId(item.id);
    setEditingText(item.text);
  };

  const handleSaveEdit = async (itemId: string) => {
    const wasSaved = await onUpdateIndication(activeSpecialtyId, itemId, editingText);
    if (wasSaved) {
      setEditingItemId(null);
      setEditingText('');
    }
  };

  const handleExportCatalog = () => {
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'indicaciones-predeterminadas-clinicas.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    setIsTransferMenuOpen(false);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      await onImportCatalog(parsed);
    } catch {
      // The hook surfaces the error as panel feedback.
    } finally {
      event.target.value = '';
      setIsTransferMenuOpen(false);
    }
  };

  const panel = isOpen ? (
    <div className="clinical-document-indications-portal-layer" aria-hidden={false}>
      <div className="clinical-document-indications-backdrop" onClick={onToggle} />
      <aside className="clinical-document-indications-panel" aria-label="Panel de indicaciones">
        <div className="clinical-document-indications-panel-header">
          <div>
            <p className="clinical-document-indications-panel-eyebrow">
              Catálogo sincronizado con Firebase
            </p>
            <h3 className="clinical-document-indications-panel-title">Indicaciones</h3>
          </div>
          <div className="clinical-document-indications-panel-header-actions">
            <div className="clinical-document-indications-transfer-menu-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="clinical-document-indications-hidden-input"
                onChange={event => void handleImportFile(event)}
              />
              <button
                type="button"
                className="clinical-document-inline-action"
                onMouseDown={event => event.preventDefault()}
                onClick={() => setIsTransferMenuOpen(current => !current)}
                aria-label="Importar o exportar catálogo"
                title="Importar o exportar"
              >
                <EllipsisVertical size={12} />
              </button>
              {isTransferMenuOpen && (
                <div className="clinical-document-indications-transfer-menu">
                  <button
                    type="button"
                    className="clinical-document-indications-transfer-option"
                    onClick={handleExportCatalog}
                  >
                    <FileDown size={12} />
                    Exportar archivo
                  </button>
                  <button
                    type="button"
                    className="clinical-document-indications-transfer-option"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canEdit || isSavingCustomIndication}
                  >
                    <FileUp size={12} />
                    Importar archivo
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="clinical-document-inline-action"
              onMouseDown={event => event.preventDefault()}
              onClick={onToggle}
              aria-label="Cerrar panel de indicaciones"
              title="Cerrar panel"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        <div
          className="clinical-document-indications-specialties"
          role="tablist"
          aria-label="Especialidades"
        >
          {specialtyList.map(specialty => (
            <button
              key={specialty.id}
              type="button"
              role="tab"
              aria-selected={specialty.id === activeSpecialtyId}
              className={`clinical-document-indications-specialty-tab${
                specialty.id === activeSpecialtyId ? ' is-active' : ''
              }`}
              onClick={() => {
                setEditingItemId(null);
                setEditingText('');
                onSelectSpecialty(specialty.id);
              }}
            >
              <span>{specialty.label}</span>
              <span className="clinical-document-indications-specialty-count">
                {specialty.items.length}
              </span>
            </button>
          ))}
        </div>

        <div className="clinical-document-indications-list">
          {activeSpecialty.items.length > 0 ? (
            activeSpecialty.items.map(item => {
              const isEditing = editingItemId === item.id;

              return (
                <div key={item.id} className="clinical-document-indications-item">
                  {isEditing ? (
                    <textarea
                      value={editingText}
                      onChange={event => setEditingText(event.target.value)}
                      rows={3}
                      className="clinical-document-indications-item-editor"
                      disabled={!canEdit || isSavingCustomIndication}
                    />
                  ) : (
                    <div className="clinical-document-indications-item-row">
                      <button
                        type="button"
                        className="clinical-document-indications-item-insert"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => onInsertIndication(item.text)}
                        disabled={!canEdit}
                      >
                        <span>{item.text}</span>
                      </button>

                      <div className="clinical-document-indications-item-meta">
                        {renderItemBadge(item)}
                        <div className="clinical-document-indications-item-actions">
                          <button
                            type="button"
                            className="clinical-document-inline-action clinical-document-inline-action--compact"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => handleStartEditing(item)}
                            disabled={!canEdit || isSavingCustomIndication}
                            aria-label={`Editar indicación ${item.text}`}
                            title="Editar"
                          >
                            <Pencil size={10} />
                          </button>
                          <button
                            type="button"
                            className="clinical-document-inline-action clinical-document-inline-action--compact clinical-document-inline-action--danger"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => void onDeleteIndication(activeSpecialtyId, item.id)}
                            disabled={!canEdit || isSavingCustomIndication}
                            aria-label={`Eliminar indicación ${item.text}`}
                            title="Eliminar"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {isEditing && (
                    <div className="clinical-document-indications-item-meta">
                      {renderItemBadge(item)}
                      <div className="clinical-document-indications-item-actions">
                        <button
                          type="button"
                          className="clinical-document-inline-action clinical-document-inline-action--compact"
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => void handleSaveEdit(item.id)}
                          disabled={!canEdit || isSavingCustomIndication || !editingText.trim()}
                          aria-label={`Guardar indicación ${item.text}`}
                          title="Guardar"
                        >
                          <Check size={10} />
                        </button>
                        <button
                          type="button"
                          className="clinical-document-inline-action clinical-document-inline-action--compact"
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => {
                            setEditingItemId(null);
                            setEditingText('');
                          }}
                          aria-label={`Cancelar edición de ${item.text}`}
                          title="Cancelar"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="clinical-document-indications-empty">
              No hay indicaciones cargadas para esta especialidad.
            </p>
          )}
        </div>

        <div className="clinical-document-indications-form">
          <label
            className="clinical-document-indications-form-label"
            htmlFor="clinical-document-custom-indication"
          >
            Agregar propia
          </label>
          <textarea
            id="clinical-document-custom-indication"
            value={customText}
            onChange={event => setCustomText(event.target.value)}
            rows={3}
            placeholder={`Nueva indicación para ${activeSpecialty.label}`}
            className="clinical-document-indications-input"
            disabled={!canEdit || isSavingCustomIndication}
          />
          <button
            type="button"
            className="clinical-document-indications-add-button"
            onClick={() => void handleAddCustomIndication()}
            disabled={!canEdit || isSavingCustomIndication || !customText.trim()}
          >
            <Plus size={14} />
            Agregar+
          </button>
          {customIndicationError && (
            <p className="clinical-document-indications-error">{customIndicationError}</p>
          )}
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={`clinical-document-inline-action clinical-document-inline-action--panel-toggle clinical-document-inline-action--panel-emoji${
          isOpen ? ' is-open' : ''
        }`}
        onMouseDown={event => event.preventDefault()}
        onClick={onToggle}
        aria-label={
          isOpen
            ? 'Cerrar panel de indicaciones predeterminadas'
            : 'Abrir panel de indicaciones predeterminadas'
        }
        title="Indicaciones predeterminadas"
      >
        <span aria-hidden="true">📋</span>
      </button>

      {panel && typeof document !== 'undefined' ? createPortal(panel, document.body) : panel}
    </>
  );
};
