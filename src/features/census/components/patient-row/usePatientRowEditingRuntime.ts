import { usePatientRowHandlersModel } from '@/features/census/components/patient-row/usePatientRowHandlersModel';
import type { PatientData } from '@/types/domain/patient';
import type { PatientFieldValue } from '@/types/valueTypes';

interface UsePatientRowEditingRuntimeParams {
  bedId: string;
  documentType?: PatientData['documentType'];
  updatePatient: (bedId: string, field: keyof PatientData, value: PatientFieldValue) => void;
  updatePatientMultiple: (bedId: string, fields: Partial<PatientData>) => void;
  updateClinicalCrib: (bedId: string, field: keyof PatientData, value: PatientFieldValue) => void;
  updateClinicalCribMultiple: (bedId: string, fields: Partial<PatientData>) => void;
}

export const usePatientRowEditingRuntime = ({
  bedId,
  documentType,
  updatePatient,
  updatePatientMultiple,
  updateClinicalCrib,
  updateClinicalCribMultiple,
}: UsePatientRowEditingRuntimeParams) =>
  usePatientRowHandlersModel({
    bedId,
    documentType,
    updatePatient,
    updatePatientMultiple,
    updateClinicalCrib,
    updateClinicalCribMultiple,
  });
