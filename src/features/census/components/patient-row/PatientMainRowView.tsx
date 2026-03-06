import React from 'react';
import { PatientBedConfig } from './PatientBedConfig';
import { PatientInputCells } from './PatientInputCells';
import { PatientMainRowActionCell } from '@/features/census/components/patient-row/PatientMainRowActionCell';
import { PatientMainRowBedTypeCell } from '@/features/census/components/patient-row/PatientMainRowBedTypeCell';
import { PatientMainRowBlockedCell } from '@/features/census/components/patient-row/PatientMainRowBlockedCell';
import type { PatientMainRowViewProps } from '@/features/census/components/patient-row/patientRowViewContracts';

export const PatientMainRowView: React.FC<PatientMainRowViewProps> = ({
  bed,
  bedType,
  data,
  currentDateString,
  style,
  readOnly,
  actionMenuAlign,
  diagnosisMode,
  isBlocked,
  isEmpty,
  hasCompanion,
  hasClinicalCrib,
  isCunaMode,
  indicators,
  mainRowViewState,
  onAction,
  onOpenDemographics,
  onOpenClinicalDocuments,
  onOpenExamRequest,
  onOpenImagingRequest,
  onOpenHistory,
  onToggleMode,
  onToggleCompanion,
  onToggleClinicalCrib,
  onToggleBedType,
  onUpdateClinicalCrib,
  onChange,
}) => {
  return (
    <tr
      className={mainRowViewState.rowClassName}
      style={style}
      data-testid="patient-row"
      data-bed-id={bed.id}
    >
      <PatientMainRowActionCell
        isBlocked={isBlocked}
        readOnly={readOnly}
        align={actionMenuAlign}
        hasClinicalDocument={indicators.hasClinicalDocument}
        isNewAdmission={indicators.isNewAdmission}
        onAction={onAction}
        onViewDemographics={onOpenDemographics}
        onViewClinicalDocuments={
          mainRowViewState.rowActionsAvailability.canOpenClinicalDocuments
            ? onOpenClinicalDocuments
            : undefined
        }
        onViewExamRequest={
          mainRowViewState.rowActionsAvailability.canOpenExamRequest ? onOpenExamRequest : undefined
        }
        onViewImagingRequest={
          mainRowViewState.rowActionsAvailability.canOpenImagingRequest
            ? onOpenImagingRequest
            : undefined
        }
        onViewHistory={
          mainRowViewState.rowActionsAvailability.canOpenHistory ? onOpenHistory : undefined
        }
      />

      <PatientBedConfig
        bed={bed}
        data={data}
        currentDateString={currentDateString}
        isBlocked={isBlocked}
        hasCompanion={hasCompanion}
        hasClinicalCrib={hasClinicalCrib}
        isCunaMode={isCunaMode}
        onToggleMode={onToggleMode}
        onToggleCompanion={onToggleCompanion}
        onToggleClinicalCrib={onToggleClinicalCrib}
        onTextChange={onChange.text}
        onUpdateClinicalCrib={onUpdateClinicalCrib}
        readOnly={readOnly}
        align={actionMenuAlign}
      />

      <PatientMainRowBedTypeCell
        bedId={bed.id}
        bedType={bedType}
        hasPatient={Boolean(data.patientName)}
        canToggleBedType={mainRowViewState.canToggleBedType}
        onToggleBedType={onToggleBedType}
      />

      {mainRowViewState.showBlockedContent ? (
        <PatientMainRowBlockedCell blockedReason={data.blockedReason} />
      ) : (
        <PatientInputCells
          data={data}
          currentDateString={currentDateString}
          isEmpty={isEmpty}
          onChange={onChange}
          onDemo={onOpenDemographics}
          readOnly={readOnly}
          diagnosisMode={diagnosisMode}
        />
      )}
    </tr>
  );
};
