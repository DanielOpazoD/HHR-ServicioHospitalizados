import {
  MEDICAL_SPECIALTIES,
  TRANSFER_BED_REQUIREMENTS,
  type DestinationHospitalOption,
} from '@/constants/transferConstants';
import type { TransferFormData, TransferRequest } from '@/types/transfers';

export interface TransferFormPatientOption {
  id: string;
  name: string;
  bedId: string;
  diagnosis: string;
}

export interface TransferFormState {
  selectedPatientId: string;
  destinationHospital: string;
  destinationHospitalOther: string;
  requiredSpecialty: string;
  requiredSpecialtyOther: string;
  requiredBedType: string;
  requiredBedTypeOther: string;
  requestDate: string;
}

type TransferFormSubmissionResult =
  | { ok: true; data: TransferFormData }
  | { ok: false; error: string };

const resolveSelectableField = (
  value: string | undefined,
  options: readonly string[],
  otherLabel: string
): { value: string; other: string } => {
  const normalizedValue = value || '';
  if (!normalizedValue) {
    return { value: '', other: '' };
  }

  const exists = options.includes(normalizedValue);
  return {
    value: exists ? normalizedValue : otherLabel,
    other: exists ? '' : normalizedValue,
  };
};

export const resolveTransferFormState = ({
  transfer,
  destinationHospitals,
  defaultRequestDate,
}: {
  transfer: TransferRequest | null;
  destinationHospitals: DestinationHospitalOption[];
  defaultRequestDate: string;
}): TransferFormState => {
  if (!transfer) {
    return {
      selectedPatientId: '',
      destinationHospital: '',
      destinationHospitalOther: '',
      requiredSpecialty: '',
      requiredSpecialtyOther: '',
      requiredBedType: '',
      requiredBedTypeOther: '',
      requestDate: defaultRequestDate,
    };
  }

  const destinationHospitalNames = destinationHospitals.map(hospital => hospital.name);
  const destinationField = resolveSelectableField(
    transfer.destinationHospital,
    destinationHospitalNames,
    'Otro'
  );
  const specialtyField = resolveSelectableField(
    transfer.requiredSpecialty,
    MEDICAL_SPECIALTIES,
    'Otra'
  );
  const bedTypeField = resolveSelectableField(
    transfer.requiredBedType,
    TRANSFER_BED_REQUIREMENTS,
    'Otra'
  );

  return {
    selectedPatientId: transfer.bedId,
    destinationHospital: destinationField.value,
    destinationHospitalOther: destinationField.other,
    requiredSpecialty: specialtyField.value,
    requiredSpecialtyOther: specialtyField.other,
    requiredBedType: bedTypeField.value,
    requiredBedTypeOther: bedTypeField.other,
    requestDate: transfer.requestDate || defaultRequestDate,
  };
};

export const buildTransferFormSubmission = ({
  selectedPatientId,
  requestDate,
  destinationHospital,
  destinationHospitalOther,
  requiredSpecialty,
  requiredSpecialtyOther,
  requiredBedType,
  requiredBedTypeOther,
}: TransferFormState): TransferFormSubmissionResult => {
  const destinationHospitalValue =
    destinationHospital === 'Otro' ? destinationHospitalOther.trim() : destinationHospital;
  const requiredSpecialtyValue =
    requiredSpecialty === 'Otra' ? requiredSpecialtyOther.trim() : requiredSpecialty;
  const requiredBedTypeValue =
    requiredBedType === 'Otra' ? requiredBedTypeOther.trim() : requiredBedType;

  if (!selectedPatientId || !destinationHospitalValue) {
    return { ok: false, error: 'Por favor complete todos los campos requeridos' };
  }
  if (destinationHospital === 'Otro' && !destinationHospitalOther.trim()) {
    return { ok: false, error: 'Debe detallar el hospital destino' };
  }
  if (requiredSpecialty === 'Otra' && !requiredSpecialtyOther.trim()) {
    return { ok: false, error: 'Debe detallar la especialidad requerida' };
  }
  if (requiredBedType === 'Otra' && !requiredBedTypeOther.trim()) {
    return { ok: false, error: 'Debe detallar el tipo de cama requerida' };
  }

  return {
    ok: true,
    data: {
      patientId: selectedPatientId,
      bedId: selectedPatientId,
      requestDate,
      destinationHospital: destinationHospitalValue,
      transferReason: 'Derivación a especialidad',
      requiredSpecialty: requiredSpecialtyValue || undefined,
      requiredBedType: requiredBedTypeValue || undefined,
      requestingDoctor: '',
      observations: '',
    },
  };
};
