import { describe, expect, it } from 'vitest';
import {
  resolveBaseModalContainerClassName,
  shouldCloseBaseModalFromBackdropClick,
} from '@/components/shared/baseModalController';

describe('baseModalController', () => {
  it('closes only when backdrop closing is enabled and the backdrop itself is clicked', () => {
    const backdrop = document.createElement('div');
    const child = document.createElement('button');

    expect(
      shouldCloseBaseModalFromBackdropClick({
        closeOnBackdrop: true,
        target: backdrop,
        currentTarget: backdrop,
      })
    ).toBe(true);

    expect(
      shouldCloseBaseModalFromBackdropClick({
        closeOnBackdrop: true,
        target: child,
        currentTarget: backdrop,
      })
    ).toBe(false);

    expect(
      shouldCloseBaseModalFromBackdropClick({
        closeOnBackdrop: false,
        target: backdrop,
        currentTarget: backdrop,
      })
    ).toBe(false);
  });

  it('builds modal container classes from size, variant and scrolling mode', () => {
    const glass = resolveBaseModalContainerClassName({
      scrollableBody: true,
      variant: 'glass',
      size: 'lg',
    });
    expect(glass).toContain('glass');
    expect(glass).toContain('max-w-lg');
    expect(glass).not.toContain('mx-auto');

    const white = resolveBaseModalContainerClassName({
      scrollableBody: false,
      variant: 'white',
      size: 'full',
      className: 'custom-modal',
    });
    expect(white).toContain('bg-white');
    expect(white).toContain('max-w-[95vw]');
    expect(white).toContain('mx-auto');
    expect(white).toContain('custom-modal');
  });
});
