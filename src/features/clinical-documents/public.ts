// Public API for code outside the clinical-documents feature. Internal consumers should import local modules directly.
export { ClinicalDocumentsModal } from './components/ClinicalDocumentsModal';
export { ClinicalDocumentsPanel } from './components/ClinicalDocumentsPanel';
export { ClinicalDocumentsWorkspace } from './components/ClinicalDocumentsWorkspace';
export type {
  ClinicalDocumentAuditActor,
  ClinicalDocumentPdfMeta,
  ClinicalDocumentRecord,
  ClinicalDocumentTemplate,
  ClinicalDocumentPatientFieldTemplate,
  ClinicalDocumentSectionTemplate,
  ClinicalDocumentPatientField,
  ClinicalDocumentSection,
  ClinicalDocumentStatus,
  ClinicalDocumentType,
} from './domain/entities';
export type { ClinicalDocumentDraftBaseState } from './hooks/clinicalDocumentDraftReducer';
export {
  createTemplatePatientField,
  createTemplateSection,
  normalizeTemplateForSave,
} from './controllers/clinicalDocumentTemplateEditorController';
export {
  buildClinicalDocumentActor,
  hydrateLegacyClinicalDocument,
  serializeClinicalDocument,
} from './controllers/clinicalDocumentWorkspaceController';
export { exportClinicalDocumentPdfViaBackend } from './services/clinicalDocumentBackendExportService';
export { generateClinicalDocumentPdfBlob } from './services/clinicalDocumentPdfService';
export { openClinicalDocumentBrowserPrintPreview } from './services/clinicalDocumentPrintPdfService';
export type { ClinicalDocumentAnnexPrintMode } from './services/clinicalDocumentPrintSupport';
export { buildClinicalDocumentEpisodeKey } from './domain/clinicalDocumentEpisodeTypes';
