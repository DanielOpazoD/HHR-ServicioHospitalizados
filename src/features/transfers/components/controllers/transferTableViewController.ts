import type { TransferRequest } from '@/types/transfers';

export interface TransferActionsMenuState {
  transfer: TransferRequest;
  top: number;
  left: number;
}

export interface TransferActionsAnchorRect {
  right: number;
  bottom: number;
}

export interface TransferDeleteDialogModel {
  title: string;
  description: string;
  patientName: string;
}

export const resolveTransferActionsMenuState = ({
  currentMenu,
  transfer,
  anchorRect,
  viewportWidth,
  menuWidth = 280,
  gutter = 12,
}: {
  currentMenu: TransferActionsMenuState | null;
  transfer: TransferRequest;
  anchorRect: TransferActionsAnchorRect;
  viewportWidth: number;
  menuWidth?: number;
  gutter?: number;
}): TransferActionsMenuState | null => {
  if (currentMenu?.transfer.id === transfer.id) {
    return null;
  }

  const left = Math.max(
    gutter,
    Math.min(anchorRect.right - menuWidth, viewportWidth - menuWidth - gutter)
  );

  return {
    transfer,
    top: anchorRect.bottom + 8,
    left,
  };
};

export const shouldCloseTransferActionsMenu = (target: HTMLElement | null): boolean =>
  !target?.closest('[data-transfer-actions-root="true"]');

export const buildTransferDeleteDialogModel = (
  transfer: TransferRequest
): TransferDeleteDialogModel => ({
  title: 'Eliminar solicitud',
  description: 'Esta acción no se puede deshacer.',
  patientName: transfer.patientSnapshot.name,
});
