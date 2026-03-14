import React from 'react';
import { PatientActionMenu } from './PatientActionMenu';
import type { PatientMainRowActionCellProps } from '@/features/census/components/patient-row/patientRowViewContracts';

export const PatientMainRowActionCell: React.FC<PatientMainRowActionCellProps> = ({
  isBlocked,
  readOnly,
  align,
  showCmaAction = true,
  accessProfile = 'default',
  hasClinicalDocument,
  isNewAdmission,
  onAction,
  onViewDemographics,
  onViewClinicalDocuments,
  onViewExamRequest,
  onViewImagingRequest,
  onViewHistory,
}) => (
  <td className="p-0 text-center border-r border-slate-200 relative w-10 print:hidden">
    <PatientActionMenu
      isBlocked={isBlocked}
      onAction={onAction}
      onViewDemographics={onViewDemographics}
      onViewClinicalDocuments={onViewClinicalDocuments}
      onViewExamRequest={onViewExamRequest}
      onViewImagingRequest={onViewImagingRequest}
      onViewHistory={onViewHistory}
      readOnly={readOnly}
      accessProfile={accessProfile}
      align={align}
      showCmaAction={showCmaAction}
      hasClinicalDocument={hasClinicalDocument}
      isNewAdmission={isNewAdmission}
    />
  </td>
);
