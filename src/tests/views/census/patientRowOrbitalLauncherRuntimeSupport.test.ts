import { describe, expect, it } from 'vitest';

import {
  resolveLauncherTriggerVisibility,
  shouldReleaseLauncherOwnership,
} from '@/features/census/components/patient-row/patientRowOrbitalLauncherRuntimeSupport';

const baseInput = {
  hasQuickActions: true,
  supportsHoverFine: true,
  isOpen: false,
  isLauncherHovered: false,
  isRowHovered: false,
  isHoverGraceActive: false,
  rowId: 'R1',
  activeLauncherRowId: null,
  ownerLauncherRowId: null,
};

describe('resolveLauncherTriggerVisibility', () => {
  it('blocks rows without quick actions and rows shadowed by another open launcher', () => {
    expect(resolveLauncherTriggerVisibility({ ...baseInput, hasQuickActions: false })).toBe(false);
    expect(resolveLauncherTriggerVisibility({ ...baseInput, activeLauncherRowId: 'R2' })).toBe(
      false
    );
  });

  it('reveals the trigger for touch devices or direct launcher activity', () => {
    expect(resolveLauncherTriggerVisibility({ ...baseInput, supportsHoverFine: false })).toBe(true);
    expect(resolveLauncherTriggerVisibility({ ...baseInput, isOpen: true })).toBe(true);
    expect(resolveLauncherTriggerVisibility({ ...baseInput, isLauncherHovered: true })).toBe(true);
  });

  it('reveals the trigger while the current row owns, hovers, or keeps grace ownership', () => {
    expect(resolveLauncherTriggerVisibility({ ...baseInput, ownerLauncherRowId: 'R1' })).toBe(true);
    expect(resolveLauncherTriggerVisibility({ ...baseInput, isRowHovered: true })).toBe(true);
    expect(resolveLauncherTriggerVisibility({ ...baseInput, isHoverGraceActive: true })).toBe(true);
  });

  it('does not let a hovered row steal ownership from another row', () => {
    expect(
      resolveLauncherTriggerVisibility({
        ...baseInput,
        isRowHovered: true,
        ownerLauncherRowId: 'R2',
      })
    ).toBe(false);
  });
});

describe('shouldReleaseLauncherOwnership', () => {
  it('releases ownership only when the current row owns the launcher and nothing is active', () => {
    expect(
      shouldReleaseLauncherOwnership({
        ownerLauncherRowId: 'R1',
        rowId: 'R1',
        isOpen: false,
        isLauncherHovered: false,
        isRowHovered: false,
      })
    ).toBe(true);
  });

  it('keeps ownership when another row owns it or interaction is still active', () => {
    expect(
      shouldReleaseLauncherOwnership({
        ownerLauncherRowId: 'R2',
        rowId: 'R1',
        isOpen: false,
        isLauncherHovered: false,
        isRowHovered: false,
      })
    ).toBe(false);

    expect(
      shouldReleaseLauncherOwnership({
        ownerLauncherRowId: 'R1',
        rowId: 'R1',
        isOpen: true,
        isLauncherHovered: false,
        isRowHovered: false,
      })
    ).toBe(false);
  });
});
