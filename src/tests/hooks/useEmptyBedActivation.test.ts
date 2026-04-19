import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmptyBedActivation } from '@/features/census/components/useEmptyBedActivation';

describe('useEmptyBedActivation', () => {
  const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
          <div data-bed-id="R2">
            <input name="patientName" value="placeholder" />
            <button title="Datos del Paciente">Abrir</button>
          </div>
        `;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback): number => {
        callback(0);
        return 1;
      }
    );
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initializes empty bed, focuses patient name input, and opens demographics', () => {
    const clickSpy = vi.fn();
    document
      .querySelector('[data-bed-id="R2"] [title="Datos del Paciente"]')
      ?.addEventListener('click', clickSpy);

    const { result } = renderHook(() => useEmptyBedActivation());

    act(() => {
      result.current.activateEmptyBed('R2');
    });

    const input = document.querySelector(
      '[data-bed-id="R2"] input[name="patientName"]'
    ) as HTMLInputElement;

    expect(input.value).toBe('');
    expect(focusSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('does not throw when input is not present', () => {
    document.body.innerHTML = '';
    const { result } = renderHook(() => useEmptyBedActivation());

    expect(() => {
      act(() => {
        result.current.activateEmptyBed('R9');
      });
    }).not.toThrow();

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('falls back when requestAnimationFrame is unavailable', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
      throw new Error('raf missing');
    });
    const clickSpy = vi.fn();
    document
      .querySelector('[data-bed-id="R2"] [title="Datos del Paciente"]')
      ?.addEventListener('click', clickSpy);

    const { result } = renderHook(() => useEmptyBedActivation());
    act(() => {
      result.current.activateEmptyBed('R2');
    });

    const input = document.querySelector(
      '[data-bed-id="R2"] input[name="patientName"]'
    ) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(focusSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
