export type ClinicalDocumentType =
  | 'epicrisis'
  | 'evolucion'
  | 'informe_medico'
  | 'epicrisis_traslado'
  | 'otro';

export type ClinicalDocumentStatus = 'draft' | 'ready_for_signature' | 'signed' | 'archived';

export interface ClinicalDocumentPatientField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'date' | 'number' | 'time';
  placeholder?: string;
  readonly?: boolean;
  visible?: boolean;
}

export type ClinicalDocumentSectionKind = 'standard' | 'clinical-update';

export interface ClinicalDocumentSection {
  id: string;
  title: string;
  content: string;
  kind?: ClinicalDocumentSectionKind;
  updateDate?: string;
  updateTime?: string;
  order: number;
  required?: boolean;
  visible?: boolean;
}

export interface ClinicalDocumentAuditActor {
  uid: string;
  email: string;
  displayName: string;
  role: string;
}

export interface ClinicalDocumentVersionMeta {
  version: number;
  savedAt: string;
  savedBy: ClinicalDocumentAuditActor;
  reason: 'autosave' | 'manual' | 'signature' | 'unsign' | 'admin_fix';
}

export interface ClinicalDocumentPdfMeta {
  fileId?: string;
  webViewLink?: string;
  folderPath?: string;
  exportedAt?: string;
  exportStatus?: 'pending' | 'exported' | 'failed';
  exportError?: string;
}

export interface ClinicalDocumentRecord {
  id: string;
  schemaVersion?: number;
  hospitalId: string;
  documentType: ClinicalDocumentType;
  templateId: string;
  templateVersion: number;
  title: string;
  patientInfoTitle: string;
  footerMedicoLabel: string;
  footerEspecialidadLabel: string;
  patientRut: string;
  patientName: string;
  episodeKey: string;
  admissionDate?: string;
  sourceDailyRecordDate?: string;
  sourceBedId?: string;
  patientFields: ClinicalDocumentPatientField[];
  sections: ClinicalDocumentSection[];
  medico: string;
  especialidad: string;
  status: ClinicalDocumentStatus;
  isLocked: boolean;
  isActiveEpisodeDocument: boolean;
  currentVersion: number;
  versionHistory: ClinicalDocumentVersionMeta[];
  audit: {
    createdAt: string;
    createdBy: ClinicalDocumentAuditActor;
    updatedAt: string;
    updatedBy: ClinicalDocumentAuditActor;
    signedAt?: string;
    signedBy?: ClinicalDocumentAuditActor;
    unsignedAt?: string;
    unsignedBy?: ClinicalDocumentAuditActor;
    signatureRevocations?: Array<{
      revokedAt: string;
      revokedBy: ClinicalDocumentAuditActor;
      previousSignedAt?: string;
      reason: string;
    }>;
    archivedAt?: string;
    archivedBy?: ClinicalDocumentAuditActor;
  };
  pdf?: ClinicalDocumentPdfMeta;
  renderedText?: string;
  integrityHash?: string;
}

export interface ClinicalDocumentPatientFieldTemplate {
  id: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'time';
  placeholder?: string;
  readonly?: boolean;
  visible?: boolean;
}

export interface ClinicalDocumentSectionTemplate {
  id: string;
  title: string;
  order: number;
  kind?: ClinicalDocumentSectionKind;
  required?: boolean;
  visible?: boolean;
}

export interface ClinicalDocumentTemplate {
  id: string;
  documentType: ClinicalDocumentType;
  name: string;
  title: string;
  defaultPatientInfoTitle: string;
  defaultFooterMedicoLabel: string;
  defaultFooterEspecialidadLabel: string;
  version: number;
  patientFields: ClinicalDocumentPatientFieldTemplate[];
  sections: ClinicalDocumentSectionTemplate[];
  allowCustomTitle: boolean;
  allowAddSection: boolean;
  allowClinicalUpdateSections: boolean;
  status: 'active' | 'archived';
}

export interface ClinicalDocumentValidationIssue {
  path: string;
  message: string;
}

export interface ClinicalDocumentEpisodeContext {
  patientRut: string;
  patientName: string;
  episodeKey: string;
  admissionDate?: string;
  sourceDailyRecordDate?: string;
  sourceBedId?: string;
  specialty?: string;
}
