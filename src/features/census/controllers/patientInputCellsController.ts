import type { PatientData } from '@/features/census/components/patient-row/patientRowDataContracts';
import { PatientInputSchema } from '@/schemas/inputSchemas';

interface ResolvePatientInputCellsLockParams {
  readOnly: boolean;
  canEditField: ((field: keyof PatientData) => boolean) | null | undefined;
}

interface ResolvePatientRutErrorParams {
  documentType: PatientData['documentType'];
  rut: PatientData['rut'];
}

export const resolvePatientInputCellsLock = ({
  readOnly,
  canEditField,
}: ResolvePatientInputCellsLockParams): boolean => {
  if (readOnly) {
    return true;
  }

  if (!canEditField) {
    return true;
  }

  return !canEditField('patientName');
};

export const resolvePatientRutValidationError = ({
  documentType,
  rut,
}: ResolvePatientRutErrorParams): boolean => {
  if (rut === '-') {
    return false;
  }

  if (documentType !== 'RUT' || !rut) {
    return false;
  }

  return !PatientInputSchema.pick({ rut: true }).safeParse({ rut }).success;
};
