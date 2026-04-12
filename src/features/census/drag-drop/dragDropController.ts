/**
 * Census Drag & Drop — Controller (pure logic).
 *
 * Resolves patient names from bed IDs and determines
 * whether a drop is valid. No React or DOM dependencies.
 */

import type { PendingBedMove } from '@/features/census/drag-drop/dragDropContracts';

/** MIME type used as dataTransfer key for the source bed ID. */
export const DRAG_DATA_FORMAT = 'text/x-bed-id';

/**
 * Builds a PendingBedMove from a successful drop event.
 * Returns null if the source/target are invalid or identical.
 */
export const buildPendingBedMove = (
  sourceBedId: string,
  targetBedId: string,
  bedsRecord: Record<string, { patientName?: string } | undefined>
): PendingBedMove | null => {
  if (!sourceBedId || !targetBedId || sourceBedId === targetBedId) {
    return null;
  }

  const patient = bedsRecord[sourceBedId];
  const patientName = patient?.patientName?.trim() || 'Paciente';

  return { sourceBedId, targetBedId, patientName };
};

/** Formats the confirmation message for a bed move. */
export const formatBedMoveConfirmationMessage = (move: PendingBedMove): string =>
  `Mover a ${move.patientName} de cama ${move.sourceBedId} a cama ${move.targetBedId}`;
