import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FilePlus2,
  FileText,
  Printer,
  Save,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import clsx from 'clsx';

import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/UIContext';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import { ClinicalDocumentRepository } from '@/services/repositories/ClinicalDocumentRepository';
import { ClinicalDocumentTemplateRepository } from '@/services/repositories/ClinicalDocumentTemplateRepository';
import type { PatientData } from '@/types';
import type {
  ClinicalDocumentRecord,
  ClinicalDocumentTemplate,
} from '@/features/clinical-documents/domain/entities';
import {
  createClinicalDocumentDraft,
  getClinicalDocumentTemplate,
} from '@/features/clinical-documents/domain/factories';
import {
  buildClinicalDocumentEpisodeContext,
  buildClinicalDocumentPatientFieldValues,
} from '@/features/clinical-documents/controllers/clinicalDocumentEpisodeController';
import {
  canEditClinicalDocuments,
  canReadClinicalDocuments,
  canSignClinicalDocument,
} from '@/features/clinical-documents/controllers/clinicalDocumentPermissionController';
import { validateClinicalDocument } from '@/features/clinical-documents/controllers/clinicalDocumentValidationController';
import {
  getClinicalDocumentTypeLabel,
  listActiveClinicalDocumentTemplates,
} from '@/features/clinical-documents/controllers/clinicalDocumentTemplateController';
import { generateClinicalDocumentPdfBlob } from '@/features/clinical-documents/services/clinicalDocumentPdfService';
import { uploadClinicalDocumentPdfToDrive } from '@/features/clinical-documents/services/clinicalDocumentDriveService';

interface ClinicalDocumentsWorkspaceProps {
  patient: PatientData;
  currentDateString: string;
  bedId: string;
  isActive?: boolean;
}

const serializeClinicalDocument = (record: ClinicalDocumentRecord | null): string =>
  record ? JSON.stringify(record) : '';

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatDateTime = (isoString?: string): string => {
  if (!isoString) return '—';
  const value = new Date(isoString);
  return Number.isNaN(value.getTime())
    ? isoString
    : value.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

export const ClinicalDocumentsWorkspace: React.FC<ClinicalDocumentsWorkspaceProps> = ({
  patient,
  currentDateString,
  bedId,
  isActive = true,
}) => {
  const { user, role } = useAuth();
  const { success, warning, error: notifyError, info } = useNotification();
  const [templates, setTemplates] = useState<ClinicalDocumentTemplate[]>(
    listActiveClinicalDocumentTemplates()
  );
  const [documents, setDocuments] = useState<ClinicalDocumentRecord[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClinicalDocumentRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastPersistedSnapshotRef = useRef<string>('');

  const canRead = canReadClinicalDocuments(role);
  const canEdit = canEditClinicalDocuments(role);
  const hospitalId = getActiveHospitalId();
  const episode = useMemo(
    () => buildClinicalDocumentEpisodeContext(patient, currentDateString, bedId),
    [bedId, currentDateString, patient]
  );

  useEffect(() => {
    if (!isActive || !canRead) {
      return;
    }

    let cancelled = false;

    const loadTemplates = async () => {
      const remoteTemplates = await ClinicalDocumentTemplateRepository.listActive(hospitalId);
      if (!cancelled) {
        setTemplates(remoteTemplates);
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [canRead, hospitalId, isActive]);

  useEffect(() => {
    if (!isActive || role !== 'admin') {
      return;
    }

    if (templates.length > 0) {
      return;
    }

    void ClinicalDocumentTemplateRepository.seedDefaults(hospitalId)
      .then(() => ClinicalDocumentTemplateRepository.listActive(hospitalId))
      .then(seedTemplates => {
        setTemplates(seedTemplates);
      })
      .catch(error => {
        console.error('[ClinicalDocumentsWorkspace] Failed to seed templates:', error);
        setTemplates(listActiveClinicalDocumentTemplates());
      });
  }, [hospitalId, isActive, role, templates.length]);

  useEffect(() => {
    if (!isActive || !canRead) {
      return;
    }

    const unsubscribe = ClinicalDocumentRepository.subscribeByEpisode(
      episode.episodeKey,
      docs => {
        setDocuments(docs);
        setSelectedDocumentId(prev => prev || docs[0]?.id || null);
      },
      hospitalId
    );

    return () => {
      unsubscribe();
    };
  }, [canRead, episode.episodeKey, hospitalId, isActive]);

  useEffect(() => {
    if (!selectedDocumentId) {
      setDraft(null);
      lastPersistedSnapshotRef.current = '';
      return;
    }
    const selected = documents.find(document => document.id === selectedDocumentId) || null;
    const cloned = selected ? structuredClone(selected) : null;
    setDraft(cloned);
    lastPersistedSnapshotRef.current = serializeClinicalDocument(cloned);
  }, [documents, selectedDocumentId]);

  useEffect(() => {
    if (!draft || !canEdit || draft.isLocked || !isActive || !user) {
      return;
    }

    const draftSnapshot = serializeClinicalDocument(draft);
    if (draftSnapshot === lastPersistedSnapshotRef.current) {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(async () => {
      try {
        setIsSaving(true);
        const now = new Date().toISOString();
        const actor = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email || 'Usuario',
          role: role || 'viewer',
        };
        const nextDraft: ClinicalDocumentRecord = {
          ...draft,
          currentVersion: draft.currentVersion + 1,
          versionHistory: [
            ...draft.versionHistory,
            {
              version: draft.currentVersion + 1,
              savedAt: now,
              savedBy: actor,
              reason: 'autosave',
            },
          ],
          audit: {
            ...draft.audit,
            updatedAt: now,
            updatedBy: actor,
          },
        };
        const saved = await ClinicalDocumentRepository.saveDraft(nextDraft, hospitalId);
        lastPersistedSnapshotRef.current = serializeClinicalDocument(saved);
        setDraft(saved);
      } catch (error) {
        console.error('[ClinicalDocumentsWorkspace] Autosave failed', error);
      } finally {
        setIsSaving(false);
      }
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [canEdit, draft, hospitalId, isActive, role, user]);

  const selectedDocument = draft;
  const selectedTemplate = selectedDocument
    ? getClinicalDocumentTemplate(selectedDocument.templateId)
    : null;
  const validationIssues = useMemo(
    () => (selectedDocument ? validateClinicalDocument(selectedDocument) : []),
    [selectedDocument]
  );

  const buildPdfFileName = (record: ClinicalDocumentRecord): string =>
    `${record.title.replace(/\s+/g, '_')}_${record.patientRut.replace(/[.\-]/g, '')}_${record.episodeKey}.pdf`;

  const createDocument = async (templateId: string) => {
    if (!canEdit || !user) {
      warning('Permiso insuficiente', 'No tienes permisos para crear documentos clínicos.');
      return;
    }

    const actor = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email || 'Usuario',
      role: role || 'viewer',
    };

    const record = createClinicalDocumentDraft({
      templateId,
      hospitalId,
      actor,
      episode,
      patientFieldValues: buildClinicalDocumentPatientFieldValues(patient),
      medico: actor.displayName,
      especialidad: episode.specialty || '',
    });

    const saved = await ClinicalDocumentRepository.createDraft(record, hospitalId);
    lastPersistedSnapshotRef.current = serializeClinicalDocument(saved);
    setSelectedDocumentId(saved.id);
    setDraft(saved);
    success(`${saved.title} creada`, 'Se generó el borrador inicial del documento.');
  };

  const patchPatientField = (fieldId: string, value: string) => {
    setDraft(prev =>
      prev
        ? {
            ...prev,
            patientFields: prev.patientFields.map(field =>
              field.id === fieldId ? { ...field, value } : field
            ),
          }
        : prev
    );
  };

  const patchSection = (sectionId: string, content: string) => {
    setDraft(prev =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map(section =>
              section.id === sectionId ? { ...section, content } : section
            ),
          }
        : prev
    );
  };

  const patchDocumentTitle = (title: string) => {
    setDraft(prev => (prev ? { ...prev, title } : prev));
  };

  const patchDocumentMeta = (
    patch: Partial<Pick<ClinicalDocumentRecord, 'medico' | 'especialidad'>>
  ) => {
    setDraft(prev => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSaveNow = async () => {
    if (!selectedDocument || !canEdit || !user) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const actor = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email || 'Usuario',
        role: role || 'viewer',
      };
      const saved = await ClinicalDocumentRepository.saveDraft(
        {
          ...selectedDocument,
          currentVersion: selectedDocument.currentVersion + 1,
          versionHistory: [
            ...selectedDocument.versionHistory,
            {
              version: selectedDocument.currentVersion + 1,
              savedAt: now,
              savedBy: actor,
              reason: 'manual',
            },
          ],
          audit: {
            ...selectedDocument.audit,
            updatedAt: now,
            updatedBy: actor,
          },
        },
        hospitalId
      );
      lastPersistedSnapshotRef.current = serializeClinicalDocument(saved);
      setDraft(saved);
      success('Documento guardado', 'Los cambios se guardaron correctamente.');
    } catch (error) {
      console.error('[ClinicalDocumentsWorkspace] Save failed', error);
      notifyError('No se pudo guardar', 'Intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!selectedDocument || !canEdit || !user) return;
    if (validationIssues.length > 0) {
      warning('Faltan datos obligatorios', validationIssues[0]?.message);
      return;
    }
    const now = new Date().toISOString();
    const actor = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email || 'Usuario',
      role: role || 'viewer',
    };
    const saved = await ClinicalDocumentRepository.saveDraft(
      {
        ...selectedDocument,
        status: 'ready_for_signature',
        currentVersion: selectedDocument.currentVersion + 1,
        versionHistory: [
          ...selectedDocument.versionHistory,
          {
            version: selectedDocument.currentVersion + 1,
            savedAt: now,
            savedBy: actor,
            reason: 'manual',
          },
        ],
        audit: {
          ...selectedDocument.audit,
          updatedAt: now,
          updatedBy: actor,
        },
      },
      hospitalId
    );
    lastPersistedSnapshotRef.current = serializeClinicalDocument(saved);
    setDraft(saved);
    success('Documento validado', `${saved.title} quedó listo para firma.`);
  };

  const handlePrint = async () => {
    if (!selectedDocument) return;
    const blob = await generateClinicalDocumentPdfBlob(selectedDocument);
    downloadBlob(blob, buildPdfFileName(selectedDocument));
    info('PDF preparado', 'Se descargó una copia PDF del documento.');
  };

  const handleSign = async () => {
    if (!selectedDocument || !user || !canSignClinicalDocument(role, selectedDocument)) {
      return;
    }
    if (validationIssues.length > 0) {
      warning('Documento incompleto', validationIssues[0]?.message);
      return;
    }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const actor = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email || 'Usuario',
        role: role || 'viewer',
      };
      const signed = await ClinicalDocumentRepository.sign(
        {
          ...selectedDocument,
          status: 'signed',
          isLocked: true,
          currentVersion: selectedDocument.currentVersion + 1,
          versionHistory: [
            ...selectedDocument.versionHistory,
            {
              version: selectedDocument.currentVersion + 1,
              savedAt: now,
              savedBy: actor,
              reason: 'signature',
            },
          ],
          audit: {
            ...selectedDocument.audit,
            updatedAt: now,
            updatedBy: actor,
            signedAt: now,
            signedBy: actor,
          },
        },
        hospitalId
      );
      lastPersistedSnapshotRef.current = serializeClinicalDocument(signed);
      setDraft(signed);
      success('Documento firmado', `${signed.title} quedó cerrado y bloqueado.`);
    } catch (error) {
      console.error('[ClinicalDocumentsWorkspace] Sign failed', error);
      notifyError('No se pudo firmar', 'Intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadPdf = async () => {
    if (!selectedDocument || selectedDocument.status !== 'signed') {
      warning(
        'Documento no firmado',
        'Solo los documentos firmados pueden exportarse a Google Drive.'
      );
      return;
    }

    setIsUploadingPdf(true);
    try {
      const pdfBlob = await generateClinicalDocumentPdfBlob(selectedDocument);
      const result = await uploadClinicalDocumentPdfToDrive(
        pdfBlob,
        buildPdfFileName(selectedDocument),
        selectedDocument.documentType,
        selectedDocument.patientName,
        selectedDocument.patientRut,
        selectedDocument.episodeKey
      );
      const exportedAt = new Date().toISOString();
      await ClinicalDocumentRepository.savePdfMetadata(
        selectedDocument.id,
        {
          fileId: result.fileId,
          webViewLink: result.webViewLink,
          folderPath: result.folderPath,
          exportedAt,
          exportStatus: 'exported',
        },
        hospitalId
      );
      setDraft(prev =>
        prev
          ? {
              ...prev,
              pdf: {
                fileId: result.fileId,
                webViewLink: result.webViewLink,
                folderPath: result.folderPath,
                exportedAt,
                exportStatus: 'exported',
              },
            }
          : prev
      );
      success('PDF exportado', 'El documento quedó respaldado en Google Drive.');
    } catch (error) {
      console.error('[ClinicalDocumentsWorkspace] Drive upload failed', error);
      if (selectedDocument) {
        await ClinicalDocumentRepository.savePdfMetadata(
          selectedDocument.id,
          {
            exportStatus: 'failed',
            exportError: error instanceof Error ? error.message : 'Error desconocido',
          },
          hospitalId
        );
        setDraft(prev =>
          prev
            ? {
                ...prev,
                pdf: {
                  ...prev.pdf,
                  exportStatus: 'failed',
                  exportError: error instanceof Error ? error.message : 'Error desconocido',
                },
              }
            : prev
        );
      }
      notifyError(
        'Falló la exportación',
        'El documento quedó guardado, pero el PDF no se pudo subir.'
      );
    } finally {
      setIsUploadingPdf(false);
    }
  };

  if (!canRead) {
    return <p className="text-sm text-slate-600">No tienes permisos para acceder a este módulo.</p>;
  }

  return (
    <div className="grid grid-cols-[320px_minmax(0,1fr)] min-h-[70vh]">
      <aside className="border-r border-slate-200 bg-slate-50/70 p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Nuevo documento
          </p>
          <div className="grid gap-2">
            {templates.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => void createDocument(template.id)}
                disabled={!canEdit || !patient.patientName}
                className={clsx(
                  'w-full rounded-xl border px-3 py-3 text-left transition-all',
                  canEdit && patient.patientName
                    ? 'border-slate-200 bg-white hover:border-medical-300 hover:bg-medical-50'
                    : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-2">
                  <FilePlus2 size={15} className="text-medical-600" />
                  <span className="text-sm font-bold text-slate-800">{template.name}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{template.title}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Episodio actual
          </p>
          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
              No hay documentos clínicos para este episodio.
            </div>
          ) : (
            documents.map(document => (
              <button
                key={document.id}
                type="button"
                onClick={() => setSelectedDocumentId(document.id)}
                className={clsx(
                  'w-full rounded-xl border px-3 py-3 text-left transition-all',
                  selectedDocumentId === document.id
                    ? 'border-medical-300 bg-medical-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-bold text-slate-800">{document.title}</span>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {getClinicalDocumentTypeLabel(document.documentType)}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                      document.status === 'signed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : document.status === 'ready_for_signature'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {document.status === 'ready_for_signature'
                      ? 'Lista'
                      : document.status === 'signed'
                        ? 'Firmada'
                        : 'Borrador'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {document.audit.updatedBy.displayName || 'Sin autor'} ·{' '}
                  {formatDateTime(document.audit.updatedAt)}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="bg-[#f3f4f6] p-4 overflow-y-auto">
        {!selectedDocument ? (
          <div className="mx-auto max-w-4xl rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            Selecciona o crea un documento clínico para comenzar.
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <ShieldCheck size={14} className="text-medical-600" />
                {selectedDocument.status === 'signed'
                  ? 'Documento firmado'
                  : selectedDocument.status === 'ready_for_signature'
                    ? 'Listo para firma'
                    : 'Borrador en edición'}
                {isSaving && <span className="text-slate-400">· guardando...</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveNow}
                  disabled={!canEdit || selectedDocument.isLocked || isSaving}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  <Save size={14} className="inline mr-2" />
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={!canEdit || selectedDocument.isLocked}
                  className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:border-slate-200"
                >
                  <CheckCircle2 size={14} className="inline mr-2" />
                  Validar
                </button>
                <button
                  type="button"
                  onClick={handleSign}
                  disabled={!canSignClinicalDocument(role, selectedDocument)}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200"
                >
                  Firmar
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
                >
                  <Printer size={14} className="inline mr-2" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleUploadPdf}
                  disabled={isUploadingPdf || selectedDocument.status !== 'signed'}
                  className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:border-slate-200"
                >
                  <UploadCloud size={14} className="inline mr-2" />
                  Drive
                </button>
              </div>
            </div>

            {validationIssues.length > 0 && selectedDocument.status !== 'signed' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {validationIssues[0]?.message}
              </div>
            )}

            <div className="rounded-2xl border border-slate-300 bg-white px-6 py-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <img
                  src="/images/logos/logo_HHR.png"
                  alt="Hospital Hanga Roa"
                  className="h-14 w-auto object-contain"
                />
                <div className="flex-1 space-y-2">
                  {selectedTemplate?.allowCustomTitle ? (
                    <input
                      type="text"
                      value={selectedDocument.title}
                      onChange={event => patchDocumentTitle(event.target.value)}
                      readOnly={!canEdit || selectedDocument.isLocked}
                      className="w-full border-none bg-transparent text-center text-2xl font-bold text-slate-800 focus:outline-none"
                    />
                  ) : (
                    <h3 className="text-center text-2xl font-bold text-slate-800">
                      {selectedDocument.title}
                    </h3>
                  )}
                  <p className="text-center text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                    {getClinicalDocumentTypeLabel(selectedDocument.documentType)} · versión{' '}
                    {selectedDocument.currentVersion}
                  </p>
                </div>
                <div className="h-14 w-14 rounded-full border border-amber-300/70 text-amber-400 flex items-center justify-center text-2xl">
                  ∞
                </div>
              </div>

              <div className="mb-4">
                <h4 className="mb-2 text-base font-bold text-slate-800">
                  Información del Paciente
                </h4>
                <div className="grid grid-cols-12 gap-3">
                  {selectedDocument.patientFields.map(field => (
                    <label
                      key={field.id}
                      className={clsx(
                        'flex flex-col gap-1',
                        field.id === 'nombre'
                          ? 'col-span-7'
                          : field.id === 'rut'
                            ? 'col-span-3'
                            : field.id === 'edad'
                              ? 'col-span-2'
                              : 'col-span-3'
                      )}
                    >
                      <span className="text-sm font-bold text-slate-700">{field.label}</span>
                      <input
                        type={field.type}
                        value={field.value}
                        onChange={event => patchPatientField(field.id, event.target.value)}
                        readOnly={!canEdit || field.readonly || selectedDocument.isLocked}
                        className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 read-only:cursor-default read-only:bg-slate-100"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {selectedDocument.sections
                  .filter(section => section.visible !== false)
                  .sort((left, right) => left.order - right.order)
                  .map(section => (
                    <label key={section.id} className="block">
                      <span className="mb-1 block text-sm font-bold text-slate-700">
                        {section.title}
                      </span>
                      <textarea
                        value={section.content}
                        onChange={event => patchSection(section.id, event.target.value)}
                        readOnly={!canEdit || selectedDocument.isLocked}
                        rows={section.id === 'historia-evolucion' ? 5 : 4}
                        className="min-h-[110px] w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-800 read-only:cursor-default read-only:bg-slate-100"
                      />
                    </label>
                  ))}
              </div>

              <div className="mt-4 grid grid-cols-12 gap-3">
                <label className="col-span-6 flex flex-col gap-1">
                  <span className="text-sm font-bold text-slate-700">Médico</span>
                  <input
                    type="text"
                    value={selectedDocument.medico}
                    onChange={event => patchDocumentMeta({ medico: event.target.value })}
                    readOnly={!canEdit || selectedDocument.isLocked}
                    className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 read-only:cursor-default read-only:bg-slate-100"
                  />
                </label>
                <label className="col-span-6 flex flex-col gap-1">
                  <span className="text-sm font-bold text-slate-700">Especialidad</span>
                  <input
                    type="text"
                    value={selectedDocument.especialidad}
                    onChange={event => patchDocumentMeta({ especialidad: event.target.value })}
                    readOnly={!canEdit || selectedDocument.isLocked}
                    className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 read-only:cursor-default read-only:bg-slate-100"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
