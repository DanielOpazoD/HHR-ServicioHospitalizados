import type {
  ClinicalDocumentSectionKind,
  ClinicalDocumentType,
} from './clinicalDocumentCoreTypes';

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
