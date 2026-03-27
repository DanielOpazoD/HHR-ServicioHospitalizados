import type { PatientActionMenuIndicators } from '@/features/census/components/patient-row/patientRowActionContracts';
import type { PatientRowViewContext } from '@/features/census/controllers/patientRowBindingSectionsController';
import { resolvePatientRowCapabilities } from '@/features/census/controllers/patientRowCapabilitiesController';
import {
  EMPTY_PATIENT_ROW_INDICATORS,
  resolvePatientRowIndicators,
} from '@/features/census/controllers/patientRowIndicatorsController';
import type { PatientData } from '@/features/census/components/patient-row/patientRowDataContracts';
import type { UserRole } from '@/types/auth';
import type { PatientRowRuntime } from '@/features/census/components/patient-row/patientRowRuntimeContracts';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';

interface PatientRowViewContextInput {
  role?: UserRole;
  data: PatientData;
  runtime: PatientRowRuntime;
  indicators?: PatientActionMenuIndicators;
  accessProfile?: CensusAccessProfile;
}

export const resolvePatientRowViewContext = ({
  role,
  data,
  runtime,
  indicators,
  accessProfile = 'default',
}: PatientRowViewContextInput): PatientRowViewContext => {
  const capabilities = resolvePatientRowCapabilities({
    role,
    patient: data,
    isBlocked: runtime.rowState.isBlocked,
    isEmpty: runtime.rowState.isEmpty,
    accessProfile,
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
  accessProfile = 'default',
}: Pick<
  PatientRowViewContextInput,
  'role' | 'data' | 'runtime' | 'accessProfile'
>): PatientRowViewContext => ({
  capabilities: resolvePatientRowViewContext({
    role,
    data,
    runtime,
    accessProfile,
    indicators: undefined as PatientActionMenuIndicators | undefined,
  }).capabilities,
  indicators: EMPTY_PATIENT_ROW_INDICATORS,
});
