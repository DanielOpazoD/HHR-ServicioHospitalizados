import type { PatientActionMenuIndicators } from '@/features/census/components/patient-row/patientRowContracts';
import type { BuildPatientRowBindingsParams } from '@/features/census/controllers/patientRowBindingsController';
import type { PatientRowViewContext } from '@/features/census/controllers/patientRowBindingSectionsController';
import { resolvePatientRowCapabilities } from '@/features/census/controllers/patientRowCapabilitiesController';
import {
  EMPTY_PATIENT_ROW_INDICATORS,
  resolvePatientRowIndicators,
} from '@/features/census/controllers/patientRowIndicatorsController';

export const resolvePatientRowViewContext = ({
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
    indicators: resolvePatientRowIndicators({
      indicators,
      canShowClinicalDocumentIndicator: capabilities.canShowClinicalDocumentIndicator,
    }),
  };
};

export const buildPatientRowModalViewContext = ({
  role,
  data,
  runtime,
}: Pick<BuildPatientRowBindingsParams, 'role' | 'data' | 'runtime'>): PatientRowViewContext => ({
  capabilities: resolvePatientRowViewContext({
    role,
    data,
    runtime,
    indicators: undefined as PatientActionMenuIndicators | undefined,
  }).capabilities,
  indicators: EMPTY_PATIENT_ROW_INDICATORS,
});
