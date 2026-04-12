/**
 * Census Drag & Drop — Public API
 */

export { useCensusTableDragDrop } from '@/features/census/drag-drop/useCensusTableDragDrop';
export { DragDropConfirmation } from '@/features/census/drag-drop/DragDropConfirmation';

export type {
  PendingBedMove,
  DragDropVisualState,
  CensusTableDragDropBundle,
} from '@/features/census/drag-drop/dragDropContracts';

export {
  buildPendingBedMove,
  formatBedMoveConfirmationMessage,
} from '@/features/census/drag-drop/dragDropController';
