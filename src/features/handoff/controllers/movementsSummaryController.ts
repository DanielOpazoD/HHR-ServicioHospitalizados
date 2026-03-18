import type { CMAData, DischargeData, TransferData } from '@/types/domain/movements';
import type { ShiftType } from '@/types/domain/base';
import { isWithinDayShift } from '@/utils/dateUtils';

interface ShiftMovement {
  time?: string;
}

export const isMovementInSelectedShift = (
  movement: ShiftMovement,
  selectedShift: ShiftType
): boolean => {
  // Legacy entries without time are interpreted as day-shift records.
  if (!movement.time) {
    return selectedShift === 'day';
  }

  const isDayTime = isWithinDayShift(movement.time);
  return selectedShift === 'day' ? isDayTime : !isDayTime;
};

export const filterDischargesByShift = (
  discharges: DischargeData[] | undefined,
  selectedShift: ShiftType
): DischargeData[] =>
  (discharges || []).filter(discharge => isMovementInSelectedShift(discharge, selectedShift));

export const filterTransfersByShift = (
  transfers: TransferData[] | undefined,
  selectedShift: ShiftType
): TransferData[] =>
  (transfers || []).filter(transfer => isMovementInSelectedShift(transfer, selectedShift));

export const filterCmaByShift = (
  cma: CMAData[] | undefined,
  selectedShift: ShiftType
): CMAData[] => (selectedShift === 'night' ? [] : cma || []);

export const resolveMovementEmptyMessage = (
  kind: 'discharges' | 'transfers' | 'cma',
  selectedShift: ShiftType
): string => {
  if (kind === 'cma') {
    return selectedShift === 'night'
      ? 'CMA solo aplica para turno de día.'
      : 'No hay pacientes de CMA hoy.';
  }

  if (kind === 'discharges') {
    return selectedShift === 'day'
      ? 'No hay altas registradas en este turno.'
      : 'No hay altas registradas durante la noche.';
  }

  return selectedShift === 'day'
    ? 'No hay traslados registrados en este turno.'
    : 'No hay traslados registrados durante la noche.';
};

export const resolveTransferDestinationLabel = (
  transfer: Pick<TransferData, 'receivingCenter' | 'receivingCenterOther'>
): string =>
  transfer.receivingCenter === 'Otro'
    ? transfer.receivingCenterOther || 'Otro'
    : transfer.receivingCenter;

export const resolveTransferEscortLabel = (
  transfer: Pick<TransferData, 'evacuationMethod' | 'transferEscort'>
): string => (transfer.evacuationMethod === 'Aerocardal' ? '-' : transfer.transferEscort || '-');

export const resolveMovementShiftBadge = (selectedShift: ShiftType): string | null =>
  selectedShift === 'night' ? '(turno noche)' : null;
