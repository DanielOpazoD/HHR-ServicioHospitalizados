import React from 'react';
import { PatientActionMenu } from './PatientActionMenu';
import type {
  PatientActionMenuCallbacks,
  PatientActionMenuIndicators,
  RowMenuAlign,
} from './patientRowContracts';

interface PatientMainRowActionCellProps
  extends PatientActionMenuCallbacks, Required<PatientActionMenuIndicators> {
  isBlocked: boolean;
  readOnly: boolean;
  align: RowMenuAlign;
}

export const PatientMainRowActionCell: React.FC<PatientMainRowActionCellProps> = ({
  isBlocked,
  readOnly,
  align,
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
      align={align}
      hasClinicalDocument={hasClinicalDocument}
      isNewAdmission={isNewAdmission}
    />
  </td>
);
