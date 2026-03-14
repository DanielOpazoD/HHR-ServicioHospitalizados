import type {
  PatientInputCellsProps,
  PatientBedConfigProps,
  PatientMainRowViewProps,
  PatientMainRowBedTypeCellProps,
  PatientMainRowBlockedCellProps,
} from '@/features/census/components/patient-row/patientRowViewContracts';
import type { PatientActionSectionBinding } from '@/features/census/controllers/patientRowActionSectionBindingsController';

export interface PatientMainRowSections {
  action: PatientActionSectionBinding;
  bedConfig: PatientBedConfigProps;
  bedType: PatientMainRowBedTypeCellProps;
  blocked: PatientMainRowBlockedCellProps;
  inputCells: PatientInputCellsProps;
}

export const buildPatientMainRowSections = (
  props: PatientMainRowViewProps,
  action: PatientActionSectionBinding
): PatientMainRowSections => ({
  action,
  bedConfig: {
    bed: props.bed,
    data: props.data,
    currentDateString: props.currentDateString,
    isBlocked: props.isBlocked,
    hasCompanion: props.hasCompanion,
    hasClinicalCrib: props.hasClinicalCrib,
    isCunaMode: props.isCunaMode,
    onToggleMode: props.onToggleMode,
    onToggleCompanion: props.onToggleCompanion,
    onToggleClinicalCrib: props.onToggleClinicalCrib,
    onTextChange: props.onChange.text,
    onUpdateClinicalCrib: props.onUpdateClinicalCrib,
    readOnly: props.readOnly,
    align: props.actionMenuAlign,
  },
  bedType: {
    bedId: props.bed.id,
    patientRut: props.data.rut || '',
    bedType: props.bedType,
    hasPatient: Boolean(props.data.patientName),
    canToggleBedType: props.mainRowViewState.canToggleBedType,
    onToggleBedType: props.onToggleBedType,
  },
  blocked: {
    blockedReason: props.data.blockedReason,
    accessProfile: props.accessProfile,
  },
  inputCells: {
    data: props.data,
    currentDateString: props.currentDateString,
    isEmpty: props.isEmpty,
    onChange: props.onChange,
    onDemo: props.onOpenDemographics,
    readOnly: props.readOnly,
    diagnosisMode: props.diagnosisMode,
    accessProfile: props.accessProfile,
  },
});
