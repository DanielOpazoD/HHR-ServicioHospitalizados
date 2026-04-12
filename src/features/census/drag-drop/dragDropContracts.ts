/**
 * Census Drag & Drop — Shared contracts.
 *
 * Types for the HTML5 native drag & drop bed-move feature.
 */

import type { DragEvent } from 'react';

/** Identifies a pending bed move awaiting user confirmation. */
export interface PendingBedMove {
  sourceBedId: string;
  targetBedId: string;
  patientName: string;
}

export interface DragDropVisualState {
  /** Bed ID of the row currently being dragged */
  dragSourceBedId: string | null;
  /** Bed ID of the empty row currently hovered during drag */
  dragOverBedId: string | null;
  /** Move awaiting user confirmation */
  pendingMove: PendingBedMove | null;
}

export interface DragDropPatientRowHandlers {
  onDragStart: (bedId: string) => (e: DragEvent) => void;
  onDragEnd: () => void;
}

export interface DragDropEmptyBedHandlers {
  onDragOver: (bedId: string) => (e: DragEvent) => void;
  onDragEnter: (bedId: string) => (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (bedId: string) => (e: DragEvent) => void;
}

export interface DragDropConfirmationHandlers {
  onConfirm: () => void;
  onCancel: () => void;
}

export interface CensusTableDragDropBundle {
  state: DragDropVisualState;
  patientHandlers: DragDropPatientRowHandlers;
  emptyBedHandlers: DragDropEmptyBedHandlers;
  confirmationHandlers: DragDropConfirmationHandlers;
}
