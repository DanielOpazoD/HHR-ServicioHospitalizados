import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';

export interface ClinicalDocumentsSidebarTemplateOption {
  id: string;
  name: string;
}

export interface ClinicalDocumentsSidebarProps {
  canEdit: boolean;
  canDelete: boolean;
  readOnlyMessage?: string | null;
  patientName?: string;
  patientRut?: string;
  templates: ClinicalDocumentsSidebarTemplateOption[];
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  onCreateDocument: () => void;
  documents: ClinicalDocumentRecord[];
  selectedDocumentId: string | null;
  onSelectDocument: (documentId: string) => void;
  onDeleteDocument: (document: ClinicalDocumentRecord) => void;
  onAddClinicalUpdate?: () => void;
  onToggleAnnex?: () => void;
  hasAnnex?: boolean;
  onOpenLabDialog?: () => void;
  onOpenMMRADDialog?: () => void;
}
