import type { PatientMainRowViewProps } from '@/features/census/components/patient-row/patientRowViewContracts';
import type { PatientMainRowActionCellProps } from '@/features/census/components/patient-row/patientRowViewContracts';
import { calculateHospitalizedDays } from '@/features/census/controllers/patientBedConfigViewController';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';

export type PatientActionSectionBinding = PatientMainRowActionCellProps;

export const buildPatientActionSectionBinding = ({
  isBlocked,
  readOnly,
  actionMenuAlign,
  indicators,
  mainRowViewState,
  accessProfile,
  data,
  currentDateString,
  onAction,
  onOpenDemographics,
  onOpenClinicalDocuments,
  onOpenExamRequest,
  onOpenImagingRequest,
  onOpenHistory,
  clinicalDocumentCount,
}: Pick<
  PatientMainRowViewProps,
  | 'isBlocked'
  | 'readOnly'
  | 'actionMenuAlign'
  | 'indicators'
  | 'mainRowViewState'
  | 'accessProfile'
  | 'data'
  | 'currentDateString'
  | 'onAction'
  | 'onOpenDemographics'
  | 'onOpenClinicalDocuments'
  | 'onOpenExamRequest'
  | 'onOpenImagingRequest'
  | 'onOpenHistory'
> & { clinicalDocumentCount?: number }): PatientActionSectionBinding => {
  const daysHospitalized = calculateHospitalizedDays({
    admissionDate: data.admissionDate,
    currentDate: currentDateString,
  });
  const medicalIndicationsPatient: MedicalIndicationsPatientOption = {
    bedId: data.bedId,
    label: `${data.bedId} - ${data.patientName || 'Paciente sin nombre'}`,
    patientName: data.patientName || '',
    rut: data.rut || '',
    diagnosis: data.pathology || '',
    age: data.age || '',
    birthDate: data.birthDate || '',
    allergies: '',
    admissionDate: data.admissionDate || '',
    daysOfStay: String(daysHospitalized ?? ''),
    treatingDoctor: '',
  };

  return {
    isBlocked,
    readOnly,
    align: actionMenuAlign,
    showCmaAction: daysHospitalized === null || daysHospitalized <= 1,
    accessProfile,
    hasClinicalDocument: indicators.hasClinicalDocument,
    isNewAdmission: indicators.isNewAdmission,
    onAction,
    onViewDemographics: onOpenDemographics,
    onViewClinicalDocuments: mainRowViewState.rowActionsAvailability.canOpenClinicalDocuments
      ? onOpenClinicalDocuments
      : undefined,
    onViewExamRequest: mainRowViewState.rowActionsAvailability.canOpenExamRequest
      ? onOpenExamRequest
      : undefined,
    onViewImagingRequest: mainRowViewState.rowActionsAvailability.canOpenImagingRequest
      ? onOpenImagingRequest
      : undefined,
    onViewMedicalIndications: data.patientName ? () => undefined : undefined,
    onViewHistory: mainRowViewState.rowActionsAvailability.canOpenHistory
      ? onOpenHistory
      : undefined,
    medicalIndicationsPatient: data.patientName ? medicalIndicationsPatient : undefined,
    clinicalDocumentCount,
  };
};
