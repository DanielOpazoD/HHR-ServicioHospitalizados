import { useMemo } from 'react';
import { useDropdownMenu } from '@/hooks/useDropdownMenu';
import type { UtilityActionConfig } from '@/features/census/components/patient-row/patientActionMenuConfig';
import {
  buildPatientActionMenuModel,
  resolvePatientActionMenuCallbackAvailability,
} from '@/features/census/controllers/patientActionMenuController';
import { buildPatientActionMenuInteractionHandlers } from '@/features/census/controllers/patientActionMenuInteractionController';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import type {
  PatientActionMenuBinding,
  PatientActionMenuIndicators,
} from './patientRowActionContracts';
import type { RowMenuAlign } from './patientRowUiContracts';

interface UsePatientActionMenuParams {
  isBlocked: boolean;
  readOnly: boolean;
  accessProfile?: CensusAccessProfile;
  align?: RowMenuAlign;
  showCmaAction?: boolean;
  indicators?: Required<PatientActionMenuIndicators>;
  onAction: (action: PatientRowAction) => void;
  onViewHistory?: () => void;
  onViewClinicalDocuments?: () => void;
  onViewExamRequest?: () => void;
  onViewImagingRequest?: () => void;
  onViewMedicalIndications?: () => void;
}

interface UsePatientActionMenuResult {
  isOpen: boolean;
  menuRef: ReturnType<typeof useDropdownMenu>['menuRef'];
  binding: PatientActionMenuBinding;
  utilityActions: UtilityActionConfig[];
  toggle: () => void;
  close: () => void;
  handleAction: (action: PatientRowAction) => void;
  handleViewHistory: () => void;
  handleViewClinicalDocuments: () => void;
  handleViewExamRequest: () => void;
  handleViewImagingRequest: () => void;
  handleViewMedicalIndications: () => void;
}

export const usePatientActionMenu = ({
  isBlocked,
  readOnly,
  accessProfile = 'default',
  align,
  showCmaAction,
  indicators,
  onAction,
  onViewHistory,
  onViewClinicalDocuments,
  onViewExamRequest,
  onViewImagingRequest,
  onViewMedicalIndications,
}: UsePatientActionMenuParams): UsePatientActionMenuResult => {
  const { isOpen, menuRef, toggle, close } = useDropdownMenu();

  const menuModel = useMemo(
    () =>
      buildPatientActionMenuModel({
        align,
        showCmaAction,
        isBlocked,
        readOnly,
        accessProfile,
        indicators,
        callbackAvailability: resolvePatientActionMenuCallbackAvailability({
          onViewHistory,
          onViewClinicalDocuments,
          onViewExamRequest,
          onViewImagingRequest,
          onViewMedicalIndications,
        }),
      }),
    [
      align,
      indicators,
      isBlocked,
      onViewClinicalDocuments,
      onViewExamRequest,
      onViewImagingRequest,
      onViewMedicalIndications,
      onViewHistory,
      accessProfile,
      readOnly,
      showCmaAction,
    ]
  );

  const interactions = useMemo(
    () =>
      buildPatientActionMenuInteractionHandlers({
        onAction,
        onViewHistory,
        onViewClinicalDocuments,
        onViewExamRequest,
        onViewImagingRequest,
        onViewMedicalIndications,
        close,
      }),
    [
      close,
      onAction,
      onViewClinicalDocuments,
      onViewExamRequest,
      onViewHistory,
      onViewImagingRequest,
      onViewMedicalIndications,
    ]
  );

  return {
    isOpen,
    menuRef,
    binding: menuModel.binding,
    utilityActions: menuModel.utilityActions,
    toggle,
    close,
    ...interactions,
  };
};
