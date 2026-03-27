import { BedDefinition } from '@/types/domain/base';
import { DailyRecord } from '@/features/census/contracts/censusDomainContracts';
import { PatientData } from '@/features/census/components/patient-row/patientRowDataContracts';
import { ControllerResult, failWithCode, ok } from '@/features/census/controllers/controllerResult';

export type MovementCreationErrorCode = 'BED_NOT_FOUND' | 'SOURCE_BED_EMPTY';

export interface MovementAuditEntry {
  bedId: string;
  patientName: string;
  rut: string;
  status: 'Vivo' | 'Fallecido';
}

export const clonePatientSnapshot = (patient: PatientData): PatientData =>
  JSON.parse(JSON.stringify(patient)) as PatientData;

export const resolveMovementBedDefinition = (
  bedId: string,
  bedsCatalog: readonly BedDefinition[]
): BedDefinition | undefined => bedsCatalog.find(bed => bed.id === bedId);

export const buildClearedBedPatient = ({
  bedId,
  location,
  createEmptyPatient,
}: {
  bedId: string;
  location?: string;
  createEmptyPatient: (bedId: string) => PatientData;
}): PatientData => {
  const cleanPatient = createEmptyPatient(bedId);
  cleanPatient.location = location;
  return cleanPatient;
};

export const resolveOccupiedMovementSource = ({
  record,
  bedId,
}: {
  record: DailyRecord;
  bedId: string;
}): ControllerResult<{ patient: PatientData }, MovementCreationErrorCode> => {
  const patient = record.beds[bedId];
  if (!patient) {
    return failWithCode('BED_NOT_FOUND', `No existe la cama ${bedId} en el registro actual.`);
  }
  if (!patient.patientName) {
    return failWithCode('SOURCE_BED_EMPTY', `No se puede operar una cama vacia: ${bedId}.`);
  }
  return ok({ patient });
};
