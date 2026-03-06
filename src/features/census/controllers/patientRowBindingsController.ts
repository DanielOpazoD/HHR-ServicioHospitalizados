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
import {
  buildPatientMainSectionBindings,
  buildPatientModalSectionBindings,
  buildPatientSubSectionBindings,
  type PatientRowResolvedIndicators,
  type PatientRowViewContext,
} from '@/features/census/controllers/patientRowBindingSectionsController';
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
  indicators?: PatientActionMenuIndicators;
  style?: React.CSSProperties;
  runtime: PatientRowRuntime;
}

export type PatientRowBindingsInput = Omit<BuildPatientRowBindingsParams, 'runtime'>;

const resolvePatientRowIndicators = (
  indicators: PatientActionMenuIndicators | undefined,
  canShowClinicalDocumentIndicator: boolean
): PatientRowResolvedIndicators => ({
  hasClinicalDocument: Boolean(indicators?.hasClinicalDocument) && canShowClinicalDocumentIndicator,
  isNewAdmission: Boolean(indicators?.isNewAdmission),
});

const resolvePatientRowViewContext = ({
  role,
  data,
  runtime,
  indicators,
}: Pick<
  BuildPatientRowBindingsParams,
  'role' | 'data' | 'runtime' | 'indicators'
>): PatientRowViewContext => {
  const capabilities = resolvePatientRowCapabilities({
    role,
    patient: data,
    isBlocked: runtime.rowState.isBlocked,
    isEmpty: runtime.rowState.isEmpty,
  });

  return {
    capabilities,
    indicators: resolvePatientRowIndicators(
      indicators,
      capabilities.canShowClinicalDocumentIndicator
    ),
  };
};

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
      : resolvePatientRowViewContext({ role, data, runtime, indicators });
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
  capabilitiesOverride,
  runtime,
}: Pick<
  BuildPatientRowBindingsParams,
  'bed' | 'data' | 'currentDateString' | 'isSubRow' | 'role' | 'runtime'
> & {
  capabilitiesOverride?: PatientRowViewContext['capabilities'];
}): PatientRowModalsBindings =>
  buildPatientModalSectionBindings({
    bedId: bed.id,
    data,
    currentDateString,
    isSubRow,
    runtime,
    viewContext: {
      capabilities:
        capabilitiesOverride ??
        resolvePatientRowViewContext({
          role,
          data,
          runtime,
          indicators: undefined,
        }).capabilities,
      indicators: {
        hasClinicalDocument: false,
        isNewAdmission: false,
      },
    },
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
  indicators,
  style,
  runtime,
}: BuildPatientRowBindingsParams): PatientRowBindings => {
  const viewContext = resolvePatientRowViewContext({ role, data, runtime, indicators });

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
      capabilitiesOverride: viewContext.capabilities,
      runtime,
    }),
  };
};
