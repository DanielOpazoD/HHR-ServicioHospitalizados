import React from 'react';
import { PatientBedConfig } from './PatientBedConfig';
import { PatientInputCells } from './PatientInputCells';
import { PatientMainRowActionCell } from '@/features/census/components/patient-row/PatientMainRowActionCell';
import { PatientMainRowBedTypeCell } from '@/features/census/components/patient-row/PatientMainRowBedTypeCell';
import { PatientMainRowBlockedCell } from '@/features/census/components/patient-row/PatientMainRowBlockedCell';
import type { PatientMainRowViewProps } from '@/features/census/components/patient-row/patientRowViewContracts';
import { buildPatientActionSectionBinding } from '@/features/census/controllers/patientRowActionSectionBindingsController';
import { buildPatientMainRowSections } from '@/features/census/controllers/patientMainRowSectionsController';

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
  const actionSectionBinding = buildPatientActionSectionBinding({
    isBlocked,
    readOnly,
    actionMenuAlign,
    indicators,
    mainRowViewState,
    onAction,
    onOpenDemographics,
    onOpenClinicalDocuments,
    onOpenExamRequest,
    onOpenImagingRequest,
    onOpenHistory,
  });
  const sections = buildPatientMainRowSections(
    {
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
    },
    actionSectionBinding
  );

  return (
    <tr
      className={mainRowViewState.rowClassName}
      style={style}
      data-testid="patient-row"
      data-bed-id={bed.id}
    >
      <PatientMainRowActionCell {...sections.action} />

      <PatientBedConfig {...sections.bedConfig} />

      <PatientMainRowBedTypeCell {...sections.bedType} />

      {mainRowViewState.showBlockedContent ? (
        <PatientMainRowBlockedCell {...sections.blocked} />
      ) : (
        <PatientInputCells {...sections.inputCells} />
      )}
    </tr>
  );
};
