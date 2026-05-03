/**
 * Concrete TransferPatientPort backed by the daily-record write service.
 *
 * Connects the canonical command (src/application/daily-record/commands/
 * transferPatientCommand) to the existing write pipeline (IndexedDB +
 * Firestore + outbox) without leaking repository or Firestore types out
 * of the service boundary.
 *
 * The transfer patch overwrites the bed with a fresh empty patient
 * snapshot — the same observable state `buildClearedPatient` produces
 * today — preserving only the bed's `location` label so the row keeps
 * its sala marker after the patient is gone.
 */
import type {
  TransferPatientInput,
  TransferPatientPort,
  TransferredPatientSnapshot,
} from '@/application/daily-record/commands/transferPatientCommand';
import { createEmptyPatient } from '@/services/factories/patientFactory';
import { updatePartial } from '@/services/repositories/dailyRecordRepositoryWriteService';
import type { DailyRecordPatch } from '@/services/contracts/dailyRecordServiceContracts';
import type { PatientData } from '@/services/contracts/patientServiceContracts';

export type TransferPatientPersistenceFn = (date: string, patch: DailyRecordPatch) => Promise<void>;

export const buildClearedTransferredBed = (input: TransferPatientInput): PatientData => {
  const cleared = createEmptyPatient(input.bedId);
  if (input.preservedLocation !== undefined) {
    cleared.location = input.preservedLocation;
  }
  return cleared;
};

export const buildTransferPatch = (input: TransferPatientInput): DailyRecordPatch => {
  const patch: Record<string, unknown> = {
    [`beds.${input.bedId}`]: buildClearedTransferredBed(input),
  };
  return patch as DailyRecordPatch;
};

const buildSnapshotFromInput = (input: TransferPatientInput): TransferredPatientSnapshot => ({
  bedId: input.bedId,
  patientName: input.patientName,
  rut: input.rut,
  destination: input.destination,
  transferDate: input.transferDate,
  recordDate: input.recordDate,
});

export const createDailyRecordTransferPatientPort = (
  persist: TransferPatientPersistenceFn = updatePartial
): TransferPatientPort => ({
  persistTransfer: async (input: TransferPatientInput): Promise<TransferredPatientSnapshot> => {
    await persist(input.recordDate, buildTransferPatch(input));
    return buildSnapshotFromInput(input);
  },
});

export const defaultDailyRecordTransferPatientPort: TransferPatientPort =
  createDailyRecordTransferPatientPort();
