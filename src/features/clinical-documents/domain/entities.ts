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
export type ClinicalDocumentSectionLayout = 'structured' | 'unified';

export interface ClinicalDocumentSection {
  id: string;
  title: string;
  content: string;
  kind?: ClinicalDocumentSectionKind;
  layout?: ClinicalDocumentSectionLayout;
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
  /** Rich text content for the annexes page (printed as a separate page). */
  annexContent?: string;
  /** Statistical discharge draft filled from epicrisis (optional). */
  ieehDraft?: ClinicalDocumentIeehDraft;
}

// ---------------------------------------------------------------------------
// IEEH type aliases for compile-time validation of MINSAL codes
// ---------------------------------------------------------------------------

/** MINSAL discharge condition codes (1-7). */
export type IeehDischargeConditionCode = '1' | '2' | '3' | '4' | '5' | '6' | '7';

/** Binary yes/no flag used for intervention and procedure fields. */
export type IeehBinaryFlag = '1' | '2';

/**
 * Draft of the IEEH (Informe Estadístico de Egreso Hospitalario)
 * captured while writing an epicrisis. The discharge time is left blank
 * because the patient hasn't physically left yet — that step belongs
 * to the nurse at the census.
 */
export interface ClinicalDocumentIeehDraft {
  /** ICD-10 / CIE-10 code (e.g. "E11.5"). */
  cie10Code: string;
  /** Official CIE-10 description in Spanish. */
  cie10Description: string;
  /** Free-text principal diagnosis. */
  diagnosticoPrincipal: string;
  /** Discharge condition code per MINSAL (1=Domicilio ... 7=Hosp. domiciliaria). */
  condicionEgreso: IeehDischargeConditionCode;
  /** Surgical intervention flag: '1' = Sí, '2' = No. */
  intervencionQuirurgica: IeehBinaryFlag;
  /** Surgical intervention description (when applicable). */
  intervencionQuirurgDescrip?: string;
  /** FONASA Anexo 9 code for the surgical intervention (e.g. "1103049"). */
  intervencionCodigo?: string;
  /** Procedure flag: '1' = Sí, '2' = No. */
  procedimiento: IeehBinaryFlag;
  /** Procedure description (when applicable). */
  procedimientoDescrip?: string;
  /** FONASA Anexo 14 code for the procedure (e.g. "0403001"). */
  procedimientoCodigo?: string;
  /** Treating doctor RUT (optional, for PDF field #49). */
  tratanteRut?: string;
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
