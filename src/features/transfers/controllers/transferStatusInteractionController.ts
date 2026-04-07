import type { TransferStatus } from '@/types/transfers';
import type { DropDirectionPosition, OverlayAnchorRect } from '@/shared/ui/anchoredOverlayTypes';

export type TransferStatusDropdownPosition = DropDirectionPosition;

interface ResolveTransferStatusDropdownPositionParams {
  buttonRect: OverlayAnchorRect;
  viewportHeight: number;
  viewportWidth: number;
  estimatedPanelHeight?: number;
  estimatedPanelWidth?: number;
  offset?: number;
  viewportPadding?: number;
}

export const TRANSFER_STATUS_OPTIONS: readonly TransferStatus[] = [
  'REQUESTED',
  'RECEIVED',
  'ACCEPTED_WITH_CAPACITY',
  'ACCEPTED_WAITING_CAPACITY',
  'REJECTED',
  'NO_RESPONSE',
  'TRANSFERRED',
] as const;

export const resolveTransferStatusDropdownPosition = ({
  buttonRect,
  viewportHeight,
  viewportWidth,
  estimatedPanelHeight = 350,
  estimatedPanelWidth = 288,
  offset = 8,
  viewportPadding = 12,
}: ResolveTransferStatusDropdownPositionParams): TransferStatusDropdownPosition => {
  const spaceBelow = viewportHeight - buttonRect.bottom;
  const dropUp = spaceBelow < estimatedPanelHeight;
  const buttonRight = buttonRect.right ?? buttonRect.left + estimatedPanelWidth;
  const preferredLeft = buttonRight - estimatedPanelWidth;
  const left = Math.max(
    viewportPadding,
    Math.min(preferredLeft, viewportWidth - estimatedPanelWidth - viewportPadding)
  );

  return {
    top: dropUp ? buttonRect.top : buttonRect.bottom + offset,
    left,
    dropUp,
  };
};
