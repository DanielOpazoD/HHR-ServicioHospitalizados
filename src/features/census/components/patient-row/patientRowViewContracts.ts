import type { CSSProperties } from 'react';
import type { DiagnosisMode } from '@/features/census/types/censusTableTypes';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import type { BedDefinition, BedType, PatientData, UserRole } from '@/types';
import type {
  ClinicalCribInputChangeHandlers,
  MainPatientInputChangeHandlers,
  PatientInputChangeHandlers,
} from '@/features/census/components/patient-row/inputCellTypes';
import type {
  PatientActionMenuCallbacks,
  PatientActionMenuIndicators,
  PatientBedConfigCallbacks,
  RowMenuAlign,
} from '@/features/census/components/patient-row/patientRowContracts';
import type { PatientMainRowViewState } from '@/features/census/controllers/patientRowMainViewController';

export interface PatientInputCellsProps {
  data: PatientData;
  currentDateString: string;
  isSubRow?: boolean;
  isEmpty?: boolean;
  onChange: PatientInputChangeHandlers;
  onDemo: () => void;
  readOnly?: boolean;
  diagnosisMode?: DiagnosisMode;
}

export interface PatientMainRowViewProps
  extends
    Omit<
      PatientActionMenuCallbacks,
      'onViewDemographics' | 'onViewExamRequest' | 'onViewImagingRequest' | 'onViewHistory'
    >,
    PatientBedConfigCallbacks {
  bed: BedDefinition;
  bedType: BedType;
  data: PatientData;
  currentDateString: string;
  style?: CSSProperties;
  readOnly: boolean;
  actionMenuAlign: RowMenuAlign;
  diagnosisMode: DiagnosisMode;
  isBlocked: boolean;
  isEmpty: boolean;
  hasCompanion: boolean;
  hasClinicalCrib: boolean;
  isCunaMode: boolean;
  indicators: Required<PatientActionMenuIndicators>;
  mainRowViewState: PatientMainRowViewState;
  onOpenDemographics: () => void;
  onOpenClinicalDocuments: () => void;
  onOpenExamRequest: () => void;
  onOpenImagingRequest: () => void;
  onOpenHistory: () => void;
  onToggleBedType: () => void;
  onChange: MainPatientInputChangeHandlers;
}

export interface PatientSubRowViewProps {
  data: PatientData;
  currentDateString: string;
  readOnly: boolean;
  diagnosisMode: DiagnosisMode;
  style?: CSSProperties;
  onOpenDemographics: () => void;
  onChange: ClinicalCribInputChangeHandlers;
}

export interface PatientRowModalsProps {
  bedId: string;
  data: PatientData;
  currentDateString: string;
  isSubRow: boolean;
  showDemographics: boolean;
  showClinicalDocuments: boolean;
  canOpenClinicalDocuments: boolean;
  showExamRequest: boolean;
  showImagingRequest: boolean;
  showHistory: boolean;
  onCloseDemographics: () => void;
  onCloseClinicalDocuments: () => void;
  onCloseExamRequest: () => void;
  onCloseImagingRequest: () => void;
  onCloseHistory: () => void;
  onSaveDemographics: (fields: Partial<PatientData>) => void;
  onSaveCribDemographics: (fields: Partial<PatientData>) => void;
}

export interface PatientRowProps {
  bed: BedDefinition;
  data: PatientData;
  currentDateString: string;
  onAction: (action: PatientRowAction, bedId: string, patient: PatientData) => void;
  readOnly?: boolean;
  actionMenuAlign?: RowMenuAlign;
  diagnosisMode?: DiagnosisMode;
  isSubRow?: boolean;
  bedType: BedType;
  role?: UserRole;
  indicators?: PatientActionMenuIndicators;
  style?: CSSProperties;
}
