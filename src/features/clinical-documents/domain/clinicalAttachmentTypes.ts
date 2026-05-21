import type {
  ClinicalDocumentAuditActor,
  ClinicalDocumentType,
} from '@/features/clinical-documents/domain/clinicalDocumentCoreTypes';

export type ClinicalAttachmentFileKind = 'image' | 'pdf' | 'docx' | 'other';

export type ClinicalAttachmentStatus = 'active' | 'deleted' | 'upload_failed';

export type ClinicalAttachmentSource =
  | 'file-picker'
  | 'pasted-image'
  | 'document-section'
  | 'episode';

export interface ClinicalAttachmentImageMeta {
  width?: number;
  height?: number;
  compressed: boolean;
  originalSizeBytes?: number;
  compressionQuality?: number;
}

export interface ClinicalAttachmentRecord {
  id: string;
  hospitalId: string;
  patientRut: string;
  patientRutKey: string;
  patientName?: string;
  episodeKey: string;
  admissionDate?: string;
  sourceDailyRecordDate?: string;
  bedId?: string;
  documentId?: string;
  documentType?: ClinicalDocumentType;
  sectionId?: string;
  storagePath: string;
  downloadUrl?: string;
  originalFileName: string;
  displayName: string;
  contentType: string;
  fileKind: ClinicalAttachmentFileKind;
  sizeBytes: number;
  image?: ClinicalAttachmentImageMeta;
  status: ClinicalAttachmentStatus;
  createdAt: string;
  createdBy: ClinicalDocumentAuditActor;
  updatedAt: string;
  updatedBy: ClinicalDocumentAuditActor;
  deletedAt?: string;
  deletedBy?: ClinicalDocumentAuditActor;
}
