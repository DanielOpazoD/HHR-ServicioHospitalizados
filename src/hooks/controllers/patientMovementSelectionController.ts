import type { DailyRecord } from '@/hooks/contracts/dailyRecordHookContracts';
import { DischargeData, TransferData } from '@/types/domain/movements';
import { PatientData } from '@/hooks/contracts/patientHookContracts';

export interface UndoMovementDescriptor {
  id: string;
  bedId: string;
  bedName: string;
  patientName: string;
  isNested?: boolean;
  originalData?: PatientData;
}

const findMovementById = <T extends { id: string }>(
  movements: readonly T[],
  movementId: string
): T | undefined => movements.find(movement => movement.id === movementId);

export const selectDischargeUndoMovement = (
  record: DailyRecord,
  movementId: string
): UndoMovementDescriptor | undefined =>
  findMovementById<DischargeData>(record.discharges, movementId);

export const selectTransferUndoMovement = (
  record: DailyRecord,
  movementId: string
): UndoMovementDescriptor | undefined =>
  findMovementById<TransferData>(record.transfers, movementId);
