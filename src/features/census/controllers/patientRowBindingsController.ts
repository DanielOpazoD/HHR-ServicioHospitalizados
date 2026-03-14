import type { DiagnosisMode } from '@/features/census/types/censusTableTypes';
import type { BedDefinition, BedType, PatientData, UserRole } from '@/types';
import type {
  PatientActionMenuIndicators,
  RowMenuAlign,
} from '@/features/census/components/patient-row/patientRowContracts';
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
  buildPatientModalSectionBindings,
  buildPatientSubSectionBindings,
  type PatientRowViewContext,
} from '@/features/census/controllers/patientRowBindingSectionsController';
import type { PatientRowResolvedIndicators } from '@/features/census/controllers/patientRowIndicatorsController';
import {
  buildPatientRowModalViewContext,
  resolvePatientRowViewContext,
} from '@/features/census/controllers/patientRowViewContextController';

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
  const viewContext =
    capabilitiesOverride && resolvedIndicatorsOverride
      ? {
          capabilities: capabilitiesOverride,
          indicators: resolvedIndicatorsOverride,
        }
      : resolvePatientRowViewContext({ role, data, runtime, indicators, accessProfile });
  return buildPatientMainSectionBindings({
    bed,
    bedType,
    data,
    currentDateString,
    readOnly,
    actionMenuAlign,
    diagnosisMode,
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
  style,
  runtime,
}: Pick<
  BuildPatientRowBindingsParams,
  'data' | 'currentDateString' | 'readOnly' | 'diagnosisMode' | 'style' | 'runtime'
>): PatientSubRowBindings =>
  buildPatientSubSectionBindings({
    data,
    currentDateString,
    readOnly,
    diagnosisMode,
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
}): PatientRowModalsBindings =>
  buildPatientModalSectionBindings({
    bedId: bed.id,
    data,
    currentDateString,
    isSubRow,
    runtime,
    viewContext: capabilitiesOverride
      ? {
          capabilities: capabilitiesOverride,
          indicators: buildPatientRowModalViewContext({
            role,
            data,
            runtime,
          }).indicators,
        }
      : buildPatientRowModalViewContext({
          role,
          data,
          runtime,
          accessProfile,
        }),
  });

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
