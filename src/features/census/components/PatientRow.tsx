import React, { Suspense, lazy } from 'react';

// Sub-components
import { PatientSubRowView } from './patient-row/PatientSubRowView';
import { PatientMainRowView } from './patient-row/PatientMainRowView';
import { usePatientRowBindingsModel } from './patient-row/usePatientRowBindingsModel';
import type { PatientRowModalsProps, PatientRowProps } from './patient-row/patientRowViewContracts';

const LazyPatientRowModals = lazy(() =>
  import('./patient-row/PatientRowModals').then(module => ({
    default: module.PatientRowModals,
  }))
);

const shouldRenderPatientRowModals = ({
  showDemographics,
  showClinicalDocuments,
  canOpenClinicalDocuments,
  showExamRequest,
  canOpenExamRequest,
  showImagingRequest,
  canOpenImagingRequest,
  showHistory,
  canOpenHistory,
}: PatientRowModalsProps) =>
  showDemographics ||
  (showClinicalDocuments && canOpenClinicalDocuments) ||
  (showExamRequest && canOpenExamRequest) ||
  (showImagingRequest && canOpenImagingRequest) ||
  (showHistory && canOpenHistory);

const PatientRowComponent: React.FC<PatientRowProps> = ({
  bed,
  data,
  currentDateString,
  onAction,
  readOnly = false,
  actionMenuAlign = 'top',
  diagnosisMode = 'free',
  isSubRow = false,
  bedType,
  role,
  accessProfile = 'default',
  indicators,
  style,
}) => {
  const bindings = usePatientRowBindingsModel({
    bed,
    bedType,
    data,
    currentDateString,
    onAction,
    readOnly,
    actionMenuAlign,
    diagnosisMode,
    isSubRow,
    role,
    accessProfile,
    style,
    indicators,
  });

  // EARLY RETURN ONLY AFTER ALL HOOKS
  if (!data) return null;

  const shouldRenderModals = shouldRenderPatientRowModals(bindings.modalsProps);

  return (
    <>
      {isSubRow ? (
        <PatientSubRowView {...bindings.subRowProps} />
      ) : (
        <PatientMainRowView {...bindings.mainRowProps} />
      )}

      {shouldRenderModals ? (
        <Suspense fallback={null}>
          <LazyPatientRowModals {...bindings.modalsProps} />
        </Suspense>
      ) : null}
    </>
  );
};

export const PatientRow = React.memo(PatientRowComponent);
