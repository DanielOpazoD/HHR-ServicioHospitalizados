import { useCallback, useMemo } from 'react';
import { useDropdownMenu } from '@/hooks/useDropdownMenu';
import {
  getVisibleUtilityActions,
  type UtilityActionConfig,
} from '@/features/census/components/patient-row/patientActionMenuConfig';
import { resolvePatientActionMenuBinding } from '@/features/census/controllers/patientActionMenuBindingController';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import type {
  PatientActionMenuBinding,
  PatientActionMenuIndicators,
  RowMenuAlign,
} from './patientRowContracts';

interface UsePatientActionMenuParams {
  isBlocked: boolean;
  readOnly: boolean;
  align?: RowMenuAlign;
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
  align,
  indicators,
  onAction,
  onViewHistory,
  onViewClinicalDocuments,
  onViewExamRequest,
  onViewImagingRequest,
}: UsePatientActionMenuParams): UsePatientActionMenuResult => {
  const { isOpen, menuRef, toggle, close } = useDropdownMenu();

  const utilityActions = useMemo(() => getVisibleUtilityActions(isBlocked), [isBlocked]);
  const binding = useMemo(
    () =>
      resolvePatientActionMenuBinding({
        align,
        isBlocked,
        readOnly,
        hasHistoryAction: typeof onViewHistory === 'function',
        hasClinicalDocumentsAction: typeof onViewClinicalDocuments === 'function',
        hasExamRequestAction: typeof onViewExamRequest === 'function',
        hasImagingRequestAction: typeof onViewImagingRequest === 'function',
        indicators,
      }),
    [
      align,
      indicators,
      isBlocked,
      onViewClinicalDocuments,
      onViewExamRequest,
      onViewImagingRequest,
      onViewHistory,
      readOnly,
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
    binding,
    utilityActions,
    toggle,
    close,
    handleAction,
    handleViewHistory,
    handleViewClinicalDocuments,
    handleViewExamRequest,
    handleViewImagingRequest,
  };
};
