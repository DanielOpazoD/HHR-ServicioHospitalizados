import type { CSSProperties } from 'react';
import type { DiagnosisMode } from '@/features/census/types/censusTableTypes';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import type { BedDefinition, BedType } from '@/types/domain/base';
import type { PatientData } from '@/features/census/components/patient-row/patientRowContracts';
import type { UserRole } from '@/types/auth';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import type {
  ClinicalCribInputChangeHandlers,
  EventTextHandler,
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
  accessProfile?: CensusAccessProfile;
}

export interface PatientBedConfigProps extends PatientBedConfigCallbacks {
  bed: BedDefinition;
  data: PatientData;
  currentDateString: string;
  isBlocked: boolean;
  hasCompanion: boolean;
  hasClinicalCrib: boolean;
  isCunaMode: boolean;
  onTextChange: EventTextHandler;
  readOnly?: boolean;
  align?: RowMenuAlign;
}

export interface PatientMainRowBedTypeCellProps {
  bedId: string;
  patientRut?: string | null;
  bedType: BedType;
  hasPatient: boolean;
  canToggleBedType: boolean;
  onToggleBedType: () => void;
}

export interface PatientMainRowBlockedCellProps {
  blockedReason?: string;
  accessProfile?: CensusAccessProfile;
}

export interface PatientMainRowActionCellProps
  extends PatientActionMenuCallbacks, Required<PatientActionMenuIndicators> {
  isBlocked: boolean;
  readOnly: boolean;
  align: RowMenuAlign;
  showCmaAction?: boolean;
  accessProfile?: CensusAccessProfile;
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
  accessProfile?: CensusAccessProfile;
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
  accessProfile?: CensusAccessProfile;
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
  canOpenExamRequest: boolean;
  showImagingRequest: boolean;
  canOpenImagingRequest: boolean;
  showHistory: boolean;
  canOpenHistory: boolean;
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
  accessProfile?: CensusAccessProfile;
  indicators?: PatientActionMenuIndicators;
  style?: CSSProperties;
}
