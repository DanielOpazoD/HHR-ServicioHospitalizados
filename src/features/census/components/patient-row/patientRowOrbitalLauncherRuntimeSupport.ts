import type React from 'react';
import type { PatientRowOrbitalLauncherPhase } from '@/features/census/components/patient-row/usePatientRowOrbitalLauncherMachine';

export const HOVER_FINE_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
export const LAUNCHER_OPEN_EVENT = 'patient-row-orbital-launcher-open-change';
export const LAUNCHER_OWNER_EVENT = 'patient-row-orbital-launcher-owner-change';

export const HOVER_EXIT_GRACE_MS = 120;

export interface LauncherPosition {
  left: number;
  top: number;
}

export interface LauncherActiveChangeDetail {
  rowId: string | null;
}

export interface UsePatientRowOrbitalLauncherRuntimeParams {
  hasQuickActions: boolean;
  isOpen: boolean;
  launcherOffset: number;
  wrapperWidth: number;
  wrapperHeight: number;
  triggerCenterX: number;
  triggerCenterY: number;
}

export interface UsePatientRowOrbitalLauncherRuntimeResult {
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  position: LauncherPosition | null;
  phase: PatientRowOrbitalLauncherPhase;
  showTrigger: boolean;
  supportsHoverFine: boolean;
  handleLauncherMouseEnter: () => void;
  handleLauncherMouseLeave: () => void;
}

export interface ResolveLauncherTriggerVisibilityInput {
  hasQuickActions: boolean;
  supportsHoverFine: boolean;
  isOpen: boolean;
  isLauncherHovered: boolean;
  isRowHovered: boolean;
  isHoverGraceActive: boolean;
  rowId: string | null;
  activeLauncherRowId: string | null;
  ownerLauncherRowId: string | null;
}

export interface ResolveLauncherOwnershipReleaseInput {
  ownerLauncherRowId: string | null;
  rowId: string | null;
  isOpen: boolean;
  isLauncherHovered: boolean;
  isRowHovered: boolean;
}

export type LauncherRowHoverAction = 'activate' | 'deactivate' | 'preserve';

export const resolveLauncherTriggerVisibility = ({
  hasQuickActions,
  supportsHoverFine,
  isOpen,
  isLauncherHovered,
  isRowHovered,
  isHoverGraceActive,
  rowId,
  activeLauncherRowId,
  ownerLauncherRowId,
}: ResolveLauncherTriggerVisibilityInput): boolean => {
  if (!hasQuickActions) {
    return false;
  }

  const isAnotherLauncherActive = activeLauncherRowId !== null && activeLauncherRowId !== rowId;
  if (isAnotherLauncherActive) {
    return false;
  }

  const isOwnedByCurrentRow = rowId !== null && ownerLauncherRowId === rowId;
  const rowCanClaimOrKeepOwnership =
    (isRowHovered || isHoverGraceActive) &&
    (ownerLauncherRowId === null || ownerLauncherRowId === rowId);

  return (
    !supportsHoverFine ||
    isOpen ||
    isLauncherHovered ||
    isOwnedByCurrentRow ||
    rowCanClaimOrKeepOwnership
  );
};

export const shouldReleaseLauncherOwnership = ({
  ownerLauncherRowId,
  rowId,
  isOpen,
  isLauncherHovered,
  isRowHovered,
}: ResolveLauncherOwnershipReleaseInput): boolean =>
  ownerLauncherRowId === rowId && !isOpen && !isLauncherHovered && !isRowHovered;

interface ResolveVisibilityHiddenLauncherStateInput {
  ownerLauncherRowId: string | null;
  rowId: string | null;
}

export const resolveVisibilityHiddenLauncherState = ({
  ownerLauncherRowId,
  rowId,
}: ResolveVisibilityHiddenLauncherStateInput) => ({
  shouldResetHoverState: true,
  shouldClearOwnership: ownerLauncherRowId === rowId,
});

export const dispatchLauncherOpenChange = (rowId: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<LauncherActiveChangeDetail>(LAUNCHER_OPEN_EVENT, {
      detail: { rowId },
    })
  );
};

export const dispatchLauncherOwnerChange = (rowId: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<LauncherActiveChangeDetail>(LAUNCHER_OWNER_EVENT, {
      detail: { rowId },
    })
  );
};

export const resolveSupportsHoverFine = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }

  return window.matchMedia(HOVER_FINE_MEDIA_QUERY).matches;
};

export const resolveRowElement = (anchor: HTMLElement | null): HTMLTableRowElement | null => {
  if (!anchor) {
    return null;
  }

  return anchor.closest('tr[data-testid="patient-row"]') as HTMLTableRowElement | null;
};

export const resolveRowId = (row: HTMLTableRowElement | null): string | null =>
  row?.dataset.bedId ?? null;

const RUT_CELL_SELECTOR = 'td.group\\/rut';

const resolveActivationZoneRightEdge = (row: HTMLTableRowElement): number => {
  const rutCell = row.querySelector(RUT_CELL_SELECTOR);
  if (rutCell) {
    return rutCell.getBoundingClientRect().right;
  }
  return row.getBoundingClientRect().right;
};

export const isPointerInActivationZone = (pointerX: number, row: HTMLTableRowElement): boolean =>
  pointerX <= resolveActivationZoneRightEdge(row);

const isPointerWithinRowBand = (pointerY: number, row: HTMLTableRowElement): boolean => {
  const rect = row.getBoundingClientRect();
  return pointerY >= rect.top && pointerY <= rect.bottom;
};

export const isPointerInExternalLeftActivationBand = (
  pointerX: number,
  pointerY: number,
  row: HTMLTableRowElement
): boolean => {
  const rect = row.getBoundingClientRect();
  return pointerX <= rect.left && isPointerWithinRowBand(pointerY, row);
};

export const resolveRowHoverActionFromRowPointer = (
  pointerX: number,
  row: HTMLTableRowElement
): LauncherRowHoverAction => (isPointerInActivationZone(pointerX, row) ? 'activate' : 'deactivate');

interface ResolveRowHoverActionFromGlobalPointerParams {
  pointerX: number;
  pointerY: number;
  row: HTMLTableRowElement;
  targetInsideRow: boolean;
}

export const resolveRowHoverActionFromGlobalPointer = ({
  pointerX,
  pointerY,
  row,
  targetInsideRow,
}: ResolveRowHoverActionFromGlobalPointerParams): LauncherRowHoverAction => {
  if (isPointerInExternalLeftActivationBand(pointerX, pointerY, row)) {
    return 'activate';
  }

  if (!targetInsideRow) {
    return 'deactivate';
  }

  return 'preserve';
};

export const resolveLauncherPosition = (
  row: HTMLTableRowElement | null,
  launcherOffset: number,
  _wrapperWidth: number,
  _wrapperHeight: number,
  triggerCenterX: number,
  triggerCenterY: number
): LauncherPosition | null => {
  if (!row) {
    return null;
  }

  const rect = row.getBoundingClientRect();
  const rawLeft = rect.left - launcherOffset - triggerCenterX;
  const triggerShellWidth = triggerCenterX * 2;
  const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - triggerShellWidth - 8));

  return {
    left: clampedLeft,
    top: rect.top + rect.height / 2 - triggerCenterY,
  };
};
