import React from 'react';
import clsx from 'clsx';

import type { PatientActionMenuBinding } from '@/features/census/components/patient-row/patientRowContracts';
import type { UtilityActionConfig } from '@/features/census/components/patient-row/patientActionMenuConfig';
import { resolvePatientActionMenuPanelClassName } from '@/features/census/controllers/patientActionMenuViewController';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import { resolvePatientActionMenuPanelModel } from '@/features/census/controllers/patientActionMenuPanelController';
import { PatientActionMenuUtilityGrid } from '@/features/census/components/patient-row/PatientActionMenuUtilityGrid';
import { PatientActionMenuClinicalSection } from '@/features/census/components/patient-row/PatientActionMenuClinicalSection';
import { PatientActionMenuHistoryAction } from '@/features/census/components/patient-row/PatientActionMenuHistoryAction';

interface PatientActionMenuPanelProps {
  isOpen: boolean;
  binding: PatientActionMenuBinding;
  utilityActions: UtilityActionConfig[];
  onClose: () => void;
  onAction: (action: PatientRowAction) => void;
  onViewHistory: () => void;
  onViewClinicalDocuments: () => void;
  onViewExamRequest: () => void;
  onViewImagingRequest: () => void;
}

export const PatientActionMenuPanel: React.FC<PatientActionMenuPanelProps> = ({
  isOpen,
  binding,
  utilityActions,
  onClose,
  onAction,
  onViewHistory,
  onViewClinicalDocuments,
  onViewExamRequest,
  onViewImagingRequest,
}) => {
  if (!isOpen) {
    return null;
  }

  const model = resolvePatientActionMenuPanelModel({
    viewState: binding.availability,
    utilityActions,
  });

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div
        className={clsx(
          'absolute left-10 z-50 bg-white shadow-xl rounded-xl border border-slate-200 w-64 text-left overflow-hidden animate-fade-in print:hidden',
          resolvePatientActionMenuPanelClassName(binding.align)
        )}
      >
        {model.showHistoryAction && (
          <PatientActionMenuHistoryAction onViewHistory={onViewHistory} />
        )}

        {model.showUtilityActions && (
          <PatientActionMenuUtilityGrid utilityActions={model.utilityActions} onAction={onAction} />
        )}

        {model.showClinicalSection && (
          <PatientActionMenuClinicalSection
            clinicalActions={model.clinicalActions}
            showClinicalDocumentsAction={model.showClinicalDocumentsAction}
            showExamRequestAction={model.showExamRequestAction}
            showImagingRequestAction={model.showImagingRequestAction}
            onAction={onAction}
            onViewClinicalDocuments={onViewClinicalDocuments}
            onViewExamRequest={onViewExamRequest}
            onViewImagingRequest={onViewImagingRequest}
          />
        )}
      </div>
    </>
  );
};
