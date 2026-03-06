import React from 'react';
import { FileText, MoreHorizontal, User } from 'lucide-react';
import { MedicalButton } from '@/components/ui/base/MedicalButton';
import type {
  PatientActionMenuCallbacks,
  PatientActionMenuIndicators,
  RowMenuAlign,
} from './patientRowContracts';
import { usePatientActionMenu } from './usePatientActionMenu';
import { PatientActionMenuPanel } from '@/features/census/components/patient-row/PatientActionMenuPanel';

interface PatientActionMenuProps extends PatientActionMenuCallbacks, PatientActionMenuIndicators {
  isBlocked: boolean;
  readOnly?: boolean;
  align?: RowMenuAlign;
}

const PatientActionPrimaryIcon: React.FC<{
  indicators: Required<PatientActionMenuIndicators>;
}> = ({ indicators }) => (
  <span className="relative inline-flex items-center justify-center h-5 w-5">
    {indicators.hasClinicalDocument && (
      <FileText
        size={11}
        className="absolute -left-1 bottom-0 text-slate-400"
        strokeWidth={2.1}
        aria-hidden="true"
      />
    )}
    <User size={16} className="relative z-10" />
    {indicators.isNewAdmission && (
      <span
        className="absolute -top-0.5 -left-0.5 h-2 w-2 rounded-full bg-amber-400 border border-white shadow-sm"
        aria-hidden="true"
      />
    )}
  </span>
);

export const PatientActionMenu: React.FC<PatientActionMenuProps> = ({
  isBlocked,
  hasClinicalDocument = false,
  isNewAdmission = false,
  onAction,
  onViewDemographics,
  onViewClinicalDocuments,
  onViewExamRequest,
  onViewImagingRequest,
  onViewHistory,
  readOnly = false,
  align = 'top',
}) => {
  const {
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
  } = usePatientActionMenu({
    isBlocked,
    readOnly,
    align,
    indicators: {
      hasClinicalDocument,
      isNewAdmission,
    },
    onAction,
    onViewHistory,
    onViewClinicalDocuments,
    onViewExamRequest,
    onViewImagingRequest,
  });

  return (
    <div className="flex flex-col items-center gap-0.5 relative py-0.5" ref={menuRef}>
      {binding.availability.showDemographicsAction && (
        <div className="flex items-center gap-0.5">
          <MedicalButton
            onClick={onViewDemographics}
            variant="ghost"
            size="xs"
            className="!px-1.5 !py-0.5 rounded-md text-medical-500 hover:text-medical-700"
            title="Datos del Paciente"
            icon={<PatientActionPrimaryIcon indicators={binding.indicators} />}
          />
        </div>
      )}
      {binding.availability.showMenuTrigger && (
        <MedicalButton
          onClick={toggle}
          variant="secondary"
          size="xs"
          className="!px-1 !py-0.5 rounded-md text-slate-500"
          title="Acciones"
          icon={<MoreHorizontal size={12} />}
        />
      )}

      <PatientActionMenuPanel
        isOpen={isOpen}
        binding={binding}
        utilityActions={utilityActions}
        onClose={close}
        onAction={handleAction}
        onViewHistory={handleViewHistory}
        onViewClinicalDocuments={handleViewClinicalDocuments}
        onViewExamRequest={handleViewExamRequest}
        onViewImagingRequest={handleViewImagingRequest}
      />
    </div>
  );
};
