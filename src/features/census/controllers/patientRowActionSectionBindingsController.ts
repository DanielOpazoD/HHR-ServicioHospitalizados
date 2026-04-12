import type { PatientMainRowViewProps } from '@/features/census/components/patient-row/patientRowViewContracts';
import type { PatientMainRowActionCellProps } from '@/features/census/components/patient-row/patientRowViewContracts';
import { calculateHospitalizedDays } from '@/features/census/controllers/patientBedConfigViewController';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';

export type PatientActionSectionBinding = PatientMainRowActionCellProps;

const buildMedicalIndicationsPatientOption = ({
  data,
  currentDateString,
}: Pick<
  PatientMainRowViewProps,
  'data' | 'currentDateString'
>): MedicalIndicationsPatientOption => {
  const daysHospitalized = calculateHospitalizedDays({
    admissionDate: data.admissionDate,
    currentDate: currentDateString,
  });

  return {
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
};

const resolveRowActionCallback = <TAction extends (() => void) | undefined>(
  canUseAction: boolean,
  action: TAction
): TAction | undefined => (canUseAction ? action : undefined);

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
  const medicalIndicationsPatient = buildMedicalIndicationsPatientOption({
    data,
    currentDateString,
  });

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
    onViewClinicalDocuments: resolveRowActionCallback(
      mainRowViewState.rowActionsAvailability.canOpenClinicalDocuments,
      onOpenClinicalDocuments
    ),
    onViewExamRequest: resolveRowActionCallback(
      mainRowViewState.rowActionsAvailability.canOpenExamRequest,
      onOpenExamRequest
    ),
    onViewImagingRequest: resolveRowActionCallback(
      mainRowViewState.rowActionsAvailability.canOpenImagingRequest,
      onOpenImagingRequest
    ),
    onViewMedicalIndications: data.patientName ? () => undefined : undefined,
    onViewHistory: resolveRowActionCallback(
      mainRowViewState.rowActionsAvailability.canOpenHistory,
      onOpenHistory
    ),
    medicalIndicationsPatient: data.patientName ? medicalIndicationsPatient : undefined,
    clinicalDocumentCount,
  };
};
