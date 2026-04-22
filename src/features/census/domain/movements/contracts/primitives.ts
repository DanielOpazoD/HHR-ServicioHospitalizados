import type { EvacuationMethod, ReceivingCenter } from '@/constants/clinicalMovementConstants';

export type DischargeTarget = 'mother' | 'baby' | 'both';
export type MoveOrCopyActionType = 'move' | 'copy' | null;

export interface MoveOrCopyActionState {
  type: MoveOrCopyActionType;
  sourceBedId: string | null;
  targetBedId: string | null;
}

export type TransferEvacuationMethod = EvacuationMethod;
export type TransferReceivingCenter = ReceivingCenter;
