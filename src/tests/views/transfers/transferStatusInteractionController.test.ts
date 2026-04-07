import { describe, expect, it } from 'vitest';
import {
  resolveTransferStatusDropdownPosition,
  TRANSFER_STATUS_OPTIONS,
  ACCEPTED_SUB_STATES,
  isAcceptedSubState,
} from '@/features/transfers/controllers/transferStatusInteractionController';

describe('transferStatusInteractionController', () => {
  it('keeps dropdown below when there is enough space', () => {
    const position = resolveTransferStatusDropdownPosition({
      buttonRect: { top: 100, bottom: 130, left: 40, right: 160 },
      viewportHeight: 900,
      viewportWidth: 1280,
    });

    expect(position).toEqual({
      top: 138,
      left: 12,
      dropUp: false,
    });
  });

  it('drops up when below space is insufficient', () => {
    const position = resolveTransferStatusDropdownPosition({
      buttonRect: { top: 700, bottom: 740, left: 16, right: 156 },
      viewportHeight: 960,
      viewportWidth: 1440,
      estimatedPanelHeight: 300,
    });

    expect(position).toEqual({
      top: 700,
      left: 12,
      dropUp: true,
    });
  });

  it('clamps dropdown horizontally near the right edge of the viewport', () => {
    const position = resolveTransferStatusDropdownPosition({
      buttonRect: { top: 120, bottom: 150, left: 980, right: 1080 },
      viewportHeight: 900,
      viewportWidth: 1100,
      estimatedPanelWidth: 288,
    });

    expect(position).toEqual({
      top: 158,
      left: 792,
      dropUp: false,
    });
  });

  it('exposes stable transfer status options order (without TRANSFERRED)', () => {
    expect(TRANSFER_STATUS_OPTIONS).toEqual([
      'REQUESTED',
      'RECEIVED',
      'ACCEPTED_WAITING_CAPACITY',
      'ACCEPTED_WITH_CAPACITY',
      'REJECTED',
      'NO_RESPONSE',
    ]);
  });

  it('identifies accepted sub-states correctly', () => {
    expect(ACCEPTED_SUB_STATES).toEqual(['ACCEPTED_WAITING_CAPACITY', 'ACCEPTED_WITH_CAPACITY']);
    expect(isAcceptedSubState('ACCEPTED_WAITING_CAPACITY')).toBe(true);
    expect(isAcceptedSubState('ACCEPTED_WITH_CAPACITY')).toBe(true);
    expect(isAcceptedSubState('ACCEPTED')).toBe(false);
    expect(isAcceptedSubState('REQUESTED')).toBe(false);
  });
});
