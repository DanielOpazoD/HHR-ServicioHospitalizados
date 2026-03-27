import { useCallback, useMemo } from 'react';
import { useDropdownMenu } from '@/hooks/useDropdownMenu';
import type { UtilityActionConfig } from '@/features/census/components/patient-row/patientActionMenuConfig';
import {
  buildPatientActionMenuModel,
  resolvePatientActionMenuCallbackAvailability,
} from '@/features/census/controllers/patientActionMenuController';
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
        }),
      }),
    [
      align,
      indicators,
      isBlocked,
      onViewClinicalDocuments,
      onViewExamRequest,
      onViewImagingRequest,
      onViewHistory,
      accessProfile,
      readOnly,
      showCmaAction,
    ]
  );

  const handleAction = useCallback(
    (action: PatientRowAction) => {
      onAction(action);
      close();
    },
    [close, onAction]
  );

  const handleViewHistory = useCallback(() => {
    onViewHistory?.();
    close();
  }, [close, onViewHistory]);

  const handleViewClinicalDocuments = useCallback(() => {
    onViewClinicalDocuments?.();
    close();
  }, [close, onViewClinicalDocuments]);

  const handleViewExamRequest = useCallback(() => {
    onViewExamRequest?.();
    close();
  }, [close, onViewExamRequest]);

  const handleViewImagingRequest = useCallback(() => {
    onViewImagingRequest?.();
    close();
  }, [close, onViewImagingRequest]);

  return {
    isOpen,
    menuRef,
    binding: menuModel.binding,
    utilityActions: menuModel.utilityActions,
    toggle,
    close,
    handleAction,
    handleViewHistory,
    handleViewClinicalDocuments,
    handleViewExamRequest,
    handleViewImagingRequest,
  };
};
