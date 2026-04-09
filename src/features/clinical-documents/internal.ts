// Internal collaboration surface for application/shared modules that need
// feature-owned clinical document contracts without re-entering the UI barrel.
export type {
  ClinicalDocumentAuditActor,
  ClinicalDocumentPdfMeta,
  ClinicalDocumentRecord,
  ClinicalDocumentStatus,
  ClinicalDocumentTemplate,
} from './domain/entities';
export type { ClinicalDocumentDraftBaseState } from './hooks/clinicalDocumentDraftReducer';
export {
  buildClinicalDocumentActor,
  hydrateLegacyClinicalDocument,
  serializeClinicalDocument,
} from './controllers/clinicalDocumentWorkspaceController';
export { exportClinicalDocumentPdfViaBackend } from './services/clinicalDocumentBackendExportService';
export { generateClinicalDocumentPdfBlob } from './services/clinicalDocumentPdfService';
export { openClinicalDocumentBrowserPrintPreview } from './services/clinicalDocumentPrintPdfService';
