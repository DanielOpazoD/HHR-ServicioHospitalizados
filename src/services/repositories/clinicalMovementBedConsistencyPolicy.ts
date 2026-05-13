import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import type { CMAData, DischargeData, TransferData } from '@/types/domain/movements';
import { createEmptyPatient } from '@/services/factories/patientFactory';

type MovementRecord = Pick<
  DischargeData | TransferData,
  'bedId' | 'patientName' | 'rut' | 'admissionDate' | 'isNested'
>;

type CmaMovementRecord = Pick<CMAData, 'originalBedId' | 'bedName' | 'patientName' | 'rut'>;

type ConfirmedMovementRecord = MovementRecord | CmaMovementRecord;

const normalizeIdentity = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const hasActivePatientIdentity = (patient: PatientData | undefined): boolean =>
  Boolean(normalizeIdentity(patient?.patientName) || normalizeIdentity(patient?.rut));

const matchesMovementPatient = (
  patient: PatientData | undefined,
  movement: ConfirmedMovementRecord
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
  const movementAdmissionDate = normalizeIdentity(
    'admissionDate' in movement ? movement.admissionDate : ''
  );
  return (
    !patientAdmissionDate ||
    !movementAdmissionDate ||
    patientAdmissionDate === movementAdmissionDate
  );
};

const resolveMovementBedId = (movement: ConfirmedMovementRecord): string => {
  if ('bedId' in movement) {
    return movement.bedId;
  }
  return movement.originalBedId || movement.bedName;
};

const isNestedMovement = (movement: ConfirmedMovementRecord): boolean =>
  'isNested' in movement && Boolean(movement.isNested);

const collectConfirmedMovementsByBed = (
  record: DailyRecord
): Map<string, ConfirmedMovementRecord[]> => {
  const byBed = new Map<string, ConfirmedMovementRecord[]>();
  const append = (movement: ConfirmedMovementRecord) => {
    const bedId = resolveMovementBedId(movement);
    if (!normalizeIdentity(bedId)) return;
    const entries = byBed.get(bedId) ?? [];
    entries.push(movement);
    byBed.set(bedId, entries);
  };

  const appendCma = (movement: CmaMovementRecord) => {
    const bedId = movement.originalBedId || movement.bedName;
    if (!bedId) return;
    append({
      ...movement,
      originalBedId: bedId,
    });
  };

  (record.discharges ?? []).forEach(append);
  (record.transfers ?? []).forEach(append);
  (record.cma ?? []).forEach(appendCma);
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
      movement => !isNestedMovement(movement) && matchesMovementPatient(currentBed, movement)
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
      movement =>
        isNestedMovement(movement) && matchesMovementPatient(currentBed.clinicalCrib, movement)
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
