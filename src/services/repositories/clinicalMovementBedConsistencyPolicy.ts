import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import type { DischargeData, TransferData } from '@/types/domain/movements';
import { createEmptyPatient } from '@/services/factories/patientFactory';

type MovementRecord = Pick<
  DischargeData | TransferData,
  'bedId' | 'patientName' | 'rut' | 'admissionDate' | 'isNested'
>;

const normalizeIdentity = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const hasActivePatientIdentity = (patient: PatientData | undefined): boolean =>
  Boolean(normalizeIdentity(patient?.patientName) || normalizeIdentity(patient?.rut));

const matchesMovementPatient = (
  patient: PatientData | undefined,
  movement: MovementRecord
): boolean => {
  if (!hasActivePatientIdentity(patient)) {
    return false;
  }

  const patientRut = normalizeIdentity(patient?.rut);
  const movementRut = normalizeIdentity(movement.rut);
  if (patientRut && movementRut) {
    return patientRut === movementRut;
  }

  const patientName = normalizeIdentity(patient?.patientName);
  const movementName = normalizeIdentity(movement.patientName);
  if (!patientName || !movementName || patientName !== movementName) {
    return false;
  }

  const patientAdmissionDate = normalizeIdentity(patient?.admissionDate);
  const movementAdmissionDate = normalizeIdentity(movement.admissionDate);
  return (
    !patientAdmissionDate ||
    !movementAdmissionDate ||
    patientAdmissionDate === movementAdmissionDate
  );
};

const collectConfirmedMovementsByBed = (record: DailyRecord): Map<string, MovementRecord[]> => {
  const byBed = new Map<string, MovementRecord[]>();
  const append = (movement: MovementRecord) => {
    const bedId = normalizeIdentity(movement.bedId);
    if (!bedId) return;
    const entries = byBed.get(movement.bedId) ?? [];
    entries.push(movement);
    byBed.set(movement.bedId, entries);
  };

  (record.discharges ?? []).forEach(append);
  (record.transfers ?? []).forEach(append);
  return byBed;
};

const buildClearedBed = (bedId: string, previous: PatientData): PatientData => {
  const cleared = createEmptyPatient(bedId);
  cleared.location = previous.location;
  return cleared;
};

export const normalizeMovementBedConsistency = (
  record: DailyRecord
): { record: DailyRecord; patches: Record<string, PatientData | undefined> } => {
  const movementsByBed = collectConfirmedMovementsByBed(record);
  if (movementsByBed.size === 0) {
    return { record, patches: {} };
  }

  const beds = { ...record.beds };
  const patches: Record<string, PatientData | undefined> = {};

  movementsByBed.forEach((movements, bedId) => {
    const currentBed = beds[bedId];
    if (!currentBed) {
      return;
    }

    const mainMovement = movements.find(
      movement => !movement.isNested && matchesMovementPatient(currentBed, movement)
    );
    if (mainMovement) {
      const cleared = buildClearedBed(bedId, currentBed);
      beds[bedId] = cleared;
      patches[`beds.${bedId}`] = cleared;
      return;
    }

    if (!currentBed.clinicalCrib) {
      return;
    }

    const nestedMovement = movements.find(
      movement => movement.isNested && matchesMovementPatient(currentBed.clinicalCrib, movement)
    );
    if (!nestedMovement) {
      return;
    }

    const updatedBed = {
      ...currentBed,
      clinicalCrib: undefined,
      hasCompanionCrib: false,
    };
    beds[bedId] = updatedBed;
    patches[`beds.${bedId}`] = updatedBed;
  });

  if (Object.keys(patches).length === 0) {
    return { record, patches };
  }

  return {
    record: {
      ...record,
      beds,
    },
    patches,
  };
};
