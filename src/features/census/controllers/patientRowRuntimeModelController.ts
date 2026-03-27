import type { BedDefinition } from '@/types/domain/base';
import type { PatientData } from '@/features/census/components/patient-row/patientRowContracts';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import type { PatientRowDependencies } from '@/features/census/components/patient-row/usePatientRowDependencies';
import type { PatientRowDerivedState } from '@/features/census/controllers/patientRowStateController';

interface BuildPatientRowEditingRuntimeParamsInput {
  bed: Pick<BedDefinition, 'id'>;
  data: Pick<PatientData, 'documentType'>;
  dependencies: Pick<
    PatientRowDependencies,
    'updatePatient' | 'updatePatientMultiple' | 'updateClinicalCrib' | 'updateClinicalCribMultiple'
  >;
}

export const buildPatientRowEditingRuntimeParams = ({
  bed,
  data,
  dependencies,
}: BuildPatientRowEditingRuntimeParamsInput) => ({
  bedId: bed.id,
  documentType: data.documentType,
  updatePatient: dependencies.updatePatient,
  updatePatientMultiple: dependencies.updatePatientMultiple,
  updateClinicalCrib: dependencies.updateClinicalCrib,
  updateClinicalCribMultiple: dependencies.updateClinicalCribMultiple,
});

interface BuildPatientRowInteractionRuntimeParamsInput {
  bed: Pick<BedDefinition, 'id'>;
  data: PatientData;
  onAction: (action: PatientRowAction, bedId: string, patient: PatientData) => void;
  rowState: Pick<PatientRowDerivedState, 'isCunaMode' | 'hasCompanion' | 'hasClinicalCrib'>;
  dependencies: Pick<
    PatientRowDependencies,
    'updatePatient' | 'updateClinicalCrib' | 'toggleBedType' | 'confirm' | 'alert'
  >;
}

export const buildPatientRowInteractionRuntimeParams = ({
  bed,
  data,
  onAction,
  rowState,
  dependencies,
}: BuildPatientRowInteractionRuntimeParamsInput) => ({
  bedId: bed.id,
  data,
  onAction,
  rowState,
  updatePatient: dependencies.updatePatient,
  updateClinicalCrib: dependencies.updateClinicalCrib,
  toggleBedType: dependencies.toggleBedType,
  confirm: dependencies.confirm,
  alert: dependencies.alert,
});
