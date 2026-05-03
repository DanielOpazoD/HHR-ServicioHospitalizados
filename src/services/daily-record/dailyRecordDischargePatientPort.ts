/**
 * Concrete DischargePatientPort backed by the daily-record write service.
 *
 * Connects the canonical command (src/application/daily-record/commands/
 * dischargePatientCommand) to the existing write pipeline (IndexedDB +
 * Firestore + outbox) without leaking repository or Firestore types out
 * of the service boundary.
 *
 * The discharge patch overwrites the bed with a fresh empty patient
 * snapshot — the same observable state the legacy
 * `buildClearedPatient` helper produces — preserving only the bed's
 * `location` label so the row keeps its sala marker after the clinician
 * is gone.
 */
import type {
  DischargePatientInput,
  DischargePatientPort,
  DischargedPatientSnapshot,
} from '@/application/daily-record/commands/dischargePatientCommand';
import { createEmptyPatient } from '@/services/factories/patientFactory';
import { updatePartial } from '@/services/repositories/dailyRecordRepositoryWriteService';
import type { DailyRecordPatch } from '@/services/contracts/dailyRecordServiceContracts';
import type { PatientData } from '@/services/contracts/patientServiceContracts';

export type DischargePatientPersistenceFn = (
  date: string,
  patch: DailyRecordPatch
) => Promise<void>;

export const buildClearedDischargedBed = (input: DischargePatientInput): PatientData => {
  const cleared = createEmptyPatient(input.bedId);
  if (input.preservedLocation !== undefined) {
    cleared.location = input.preservedLocation;
  }
  return cleared;
};

export const buildDischargePatch = (input: DischargePatientInput): DailyRecordPatch => {
  const patch: Record<string, unknown> = {
    [`beds.${input.bedId}`]: buildClearedDischargedBed(input),
  };
  return patch as DailyRecordPatch;
};

const buildSnapshotFromInput = (input: DischargePatientInput): DischargedPatientSnapshot => ({
  bedId: input.bedId,
  patientName: input.patientName,
  rut: input.rut,
  dischargeStatus: input.dischargeStatus,
  dischargeDate: input.dischargeDate,
  recordDate: input.recordDate,
});

export const createDailyRecordDischargePatientPort = (
  persist: DischargePatientPersistenceFn = updatePartial
): DischargePatientPort => ({
  persistDischarge: async (input: DischargePatientInput): Promise<DischargedPatientSnapshot> => {
    await persist(input.recordDate, buildDischargePatch(input));
    return buildSnapshotFromInput(input);
  },
});

export const defaultDailyRecordDischargePatientPort: DischargePatientPort =
  createDailyRecordDischargePatientPort();
