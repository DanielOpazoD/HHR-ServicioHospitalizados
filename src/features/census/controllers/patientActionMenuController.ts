import {
  getVisibleUtilityActions,
  type UtilityActionConfig,
} from '@/features/census/components/patient-row/patientActionMenuConfig';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import { canUseCensusUtilityActions } from '@/shared/access/operationalAccessPolicy';
import type {
  PatientActionMenuBinding,
  PatientActionMenuIndicators,
} from '@/features/census/components/patient-row/patientRowActionContracts';
import type { RowMenuAlign } from '@/features/census/components/patient-row/patientRowUiContracts';
import { resolvePatientActionMenuBinding } from '@/features/census/controllers/patientActionMenuBindingController';

export interface PatientActionMenuCallbackAvailability {
  hasHistoryAction: boolean;
  hasClinicalDocumentsAction: boolean;
  hasExamRequestAction: boolean;
  hasImagingRequestAction: boolean;
}

interface ResolvePatientActionMenuCallbackAvailabilityParams {
  onViewHistory?: () => void;
  onViewClinicalDocuments?: () => void;
  onViewExamRequest?: () => void;
  onViewImagingRequest?: () => void;
}

export const resolvePatientActionMenuCallbackAvailability = ({
  onViewHistory,
  onViewClinicalDocuments,
  onViewExamRequest,
  onViewImagingRequest,
}: ResolvePatientActionMenuCallbackAvailabilityParams): PatientActionMenuCallbackAvailability => ({
  hasHistoryAction: typeof onViewHistory === 'function',
  hasClinicalDocumentsAction: typeof onViewClinicalDocuments === 'function',
  hasExamRequestAction: typeof onViewExamRequest === 'function',
  hasImagingRequestAction: typeof onViewImagingRequest === 'function',
});

interface BuildPatientActionMenuModelParams {
  align?: RowMenuAlign;
  isBlocked: boolean;
  readOnly: boolean;
  accessProfile?: CensusAccessProfile;
  showCmaAction?: boolean;
  indicators?: Required<PatientActionMenuIndicators>;
  callbackAvailability: PatientActionMenuCallbackAvailability;
}

export interface PatientActionMenuModel {
  binding: PatientActionMenuBinding;
  utilityActions: UtilityActionConfig[];
}

export const buildPatientActionMenuModel = ({
  align,
  isBlocked,
  readOnly,
  accessProfile = 'default',
  showCmaAction,
  indicators,
  callbackAvailability,
}: BuildPatientActionMenuModelParams): PatientActionMenuModel => ({
  binding: resolvePatientActionMenuBinding({
    align,
    showCmaAction,
    isBlocked,
    readOnly,
    accessProfile,
    indicators,
    ...callbackAvailability,
  }),
  utilityActions: canUseCensusUtilityActions({ readOnly, accessProfile })
    ? getVisibleUtilityActions(isBlocked)
    : [],
});
