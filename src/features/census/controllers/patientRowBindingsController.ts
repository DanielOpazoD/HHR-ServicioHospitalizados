import type { DiagnosisMode } from '@/features/census/types/censusTableTypes';
import type { BedDefinition, BedType } from '@/features/census/contracts/censusBedContracts';
import type { PatientData } from '@/features/census/components/patient-row/patientRowDataContracts';
import type { UserRole } from '@/types/auth';
import type { PatientActionMenuIndicators } from '@/features/census/components/patient-row/patientRowActionContracts';
import type { RowMenuAlign } from '@/features/census/components/patient-row/patientRowUiContracts';
import type {
  PatientMainRowBindings,
  PatientSubRowBindings,
  PatientRowModalsBindings,
  PatientRowBindings,
  PatientRowRuntime,
} from '@/features/census/components/patient-row/patientRowRuntimeContracts';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import {
  buildPatientMainSectionBindings,
  buildPatientSubSectionBindings,
  type PatientRowViewContext,
} from '@/features/census/controllers/patientRowBindingSectionsController';
import type { PatientRowResolvedIndicators } from '@/features/census/controllers/patientRowIndicatorsController';
import { resolvePatientRowViewContext } from '@/features/census/controllers/patientRowViewContextController';
import { resolvePatientRowCapabilities } from '@/features/census/controllers/patientRowCapabilitiesController';

export interface BuildPatientRowBindingsParams {
  bed: BedDefinition;
  bedType: BedType;
  data: PatientData;
  currentDateString: string;
  readOnly: boolean;
  actionMenuAlign: RowMenuAlign;
  diagnosisMode: DiagnosisMode;
  isSubRow: boolean;
  role?: UserRole;
  accessProfile?: CensusAccessProfile;
  indicators?: PatientActionMenuIndicators;
  style?: React.CSSProperties;
  runtime: PatientRowRuntime;
}

export type PatientRowBindingsInput = Omit<BuildPatientRowBindingsParams, 'runtime'>;

const resolvePatientRowContextWithOverrides = ({
  role,
  data,
  runtime,
  indicators,
  accessProfile,
  capabilitiesOverride,
  resolvedIndicatorsOverride,
}: {
  role?: UserRole;
  data: PatientData;
  runtime: PatientRowRuntime;
  indicators?: PatientActionMenuIndicators;
  accessProfile?: CensusAccessProfile;
  capabilitiesOverride?: PatientRowViewContext['capabilities'];
  resolvedIndicatorsOverride?: PatientRowResolvedIndicators;
}): PatientRowViewContext =>
  capabilitiesOverride && resolvedIndicatorsOverride
    ? {
        capabilities: capabilitiesOverride,
        indicators: resolvedIndicatorsOverride,
      }
    : resolvePatientRowViewContext({ role, data, runtime, indicators, accessProfile });

const resolvePatientRowCapabilitiesWithOverrides = ({
  role,
  data,
  runtime,
  accessProfile,
  capabilitiesOverride,
}: {
  role?: UserRole;
  data: PatientData;
  runtime: PatientRowRuntime;
  accessProfile?: CensusAccessProfile;
  capabilitiesOverride?: PatientRowViewContext['capabilities'];
}): PatientRowViewContext['capabilities'] =>
  capabilitiesOverride
    ? capabilitiesOverride
    : resolvePatientRowCapabilities({
        role,
        patient: data,
        isBlocked: runtime.rowState.isBlocked,
        isEmpty: runtime.rowState.isEmpty,
        accessProfile,
      });

export const buildPatientMainRowBindings = ({
  bed,
  bedType,
  data,
  currentDateString,
  readOnly,
  actionMenuAlign,
  diagnosisMode,
  role,
  indicators,
  accessProfile,
  style,
  capabilitiesOverride,
  resolvedIndicatorsOverride,
  runtime,
}: Pick<
  BuildPatientRowBindingsParams,
  | 'bed'
  | 'bedType'
  | 'data'
  | 'currentDateString'
  | 'readOnly'
  | 'actionMenuAlign'
  | 'diagnosisMode'
  | 'role'
  | 'accessProfile'
  | 'indicators'
  | 'style'
  | 'runtime'
> & {
  capabilitiesOverride?: PatientRowViewContext['capabilities'];
  resolvedIndicatorsOverride?: PatientRowResolvedIndicators;
}): PatientMainRowBindings => {
  const viewContext = resolvePatientRowContextWithOverrides({
    role,
    data,
    runtime,
    indicators,
    accessProfile,
    capabilitiesOverride,
    resolvedIndicatorsOverride,
  });
  return buildPatientMainSectionBindings({
    bed,
    bedType,
    data,
    currentDateString,
    readOnly,
    actionMenuAlign,
    diagnosisMode,
    accessProfile,
    style,
    runtime,
    viewContext,
  });
};

export const buildPatientSubRowBindings = ({
  data,
  currentDateString,
  readOnly,
  diagnosisMode,
  accessProfile,
  style,
  runtime,
}: Pick<
  BuildPatientRowBindingsParams,
  | 'data'
  | 'currentDateString'
  | 'readOnly'
  | 'diagnosisMode'
  | 'accessProfile'
  | 'style'
  | 'runtime'
>): PatientSubRowBindings =>
  buildPatientSubSectionBindings({
    data,
    currentDateString,
    readOnly,
    diagnosisMode,
    accessProfile,
    style,
    runtime,
  });

export const buildPatientRowModalsBindings = ({
  bed,
  data,
  currentDateString,
  isSubRow,
  role,
  accessProfile,
  capabilitiesOverride,
  runtime,
}: Pick<
  BuildPatientRowBindingsParams,
  'bed' | 'data' | 'currentDateString' | 'isSubRow' | 'role' | 'runtime'
> & {
  capabilitiesOverride?: PatientRowViewContext['capabilities'];
  accessProfile?: CensusAccessProfile;
}): PatientRowModalsBindings => {
  const capabilities = resolvePatientRowCapabilitiesWithOverrides({
    role,
    data,
    runtime,
    accessProfile,
    capabilitiesOverride,
  });

  return {
    bedId: bed.id,
    data,
    currentDateString,
    isSubRow,
    showDemographics: runtime.uiState.showDemographics,
    showClinicalDocuments: runtime.uiState.showClinicalDocuments,
    canOpenClinicalDocuments: capabilities.canOpenClinicalDocuments,
    showExamRequest: runtime.uiState.showExamRequest,
    canOpenExamRequest: capabilities.canOpenExamRequest,
    showImagingRequest: runtime.uiState.showImagingRequest,
    canOpenImagingRequest: capabilities.canOpenImagingRequest,
    showHistory: runtime.uiState.showHistory,
    canOpenHistory: capabilities.canOpenHistory,
    onCloseDemographics: runtime.uiState.closeDemographics,
    onCloseClinicalDocuments: runtime.uiState.closeClinicalDocuments,
    onCloseExamRequest: runtime.uiState.closeExamRequest,
    onCloseImagingRequest: runtime.uiState.closeImagingRequest,
    onCloseHistory: runtime.uiState.closeHistory,
    onSaveDemographics: runtime.modalSavers.onSaveDemographics,
    onSaveCribDemographics: runtime.modalSavers.onSaveCribDemographics,
  };
};

export const buildPatientRowBindings = ({
  bed,
  bedType,
  data,
  currentDateString,
  readOnly,
  actionMenuAlign,
  diagnosisMode,
  isSubRow,
  role,
  accessProfile,
  indicators,
  style,
  runtime,
}: BuildPatientRowBindingsParams): PatientRowBindings => {
  const viewContext = resolvePatientRowViewContext({
    role,
    data,
    runtime,
    indicators,
    accessProfile,
  });

  return {
    mainRowProps: buildPatientMainRowBindings({
      bed,
      bedType,
      data,
      currentDateString,
      readOnly,
      actionMenuAlign,
      diagnosisMode,
      role,
      accessProfile,
      indicators,
      style,
      capabilitiesOverride: viewContext.capabilities,
      resolvedIndicatorsOverride: viewContext.indicators,
      runtime,
    }),
    subRowProps: buildPatientSubRowBindings({
      data,
      currentDateString,
      readOnly,
      diagnosisMode,
      accessProfile,
      style,
      runtime,
    }),
    modalsProps: buildPatientRowModalsBindings({
      bed,
      data,
      currentDateString,
      isSubRow,
      role,
      accessProfile,
      capabilitiesOverride: viewContext.capabilities,
      runtime,
    }),
  };
};
