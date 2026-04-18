import { describe, expect, it, vi } from 'vitest';
import {
  buildDemographicsButtonSelector,
  buildPatientNameSelector,
  executeActivateEmptyBedController,
} from '@/features/census/controllers/censusEmptyBedActivationController';

describe('censusEmptyBedActivationController', () => {
  it('builds selector with bed id', () => {
    expect(buildPatientNameSelector('R2')).toBe('[data-bed-id="R2"] input[name="patientName"]');
    expect(buildDemographicsButtonSelector('R2')).toBe(
      '[data-bed-id="R2"] [title="Datos del Paciente"]'
    );
  });

  it('focuses input, clears temporary value, and opens demographics when element exists', () => {
    document.body.innerHTML = `
          <div data-bed-id="R2">
            <input name="patientName" value="tmp" />
            <button title="Datos del Paciente">Abrir</button>
          </div>
        `;
    const updatePatient = vi.fn();
    const clickSpy = vi.fn();
    document
      .querySelector('[data-bed-id="R2"] [title="Datos del Paciente"]')
      ?.addEventListener('click', clickSpy);

    const result = executeActivateEmptyBedController({
      bedId: 'R2',
      runtime: {
        updatePatient,
        requestFrame: callback => callback(),
        querySelector: selector => document.querySelector(selector),
      },
    });

    const input = document.querySelector(
      '[data-bed-id="R2"] input[name="patientName"]'
    ) as HTMLInputElement;
    expect(updatePatient).toHaveBeenCalledWith('R2', 'patientName', ' ');
    expect(result).toEqual({
      ok: true,
      value: {
        outcome: 'focused',
        selector: '[data-bed-id="R2"] input[name="patientName"]',
      },
    });
    expect(input.value).toBe('');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('returns input_not_found when patient input is missing', () => {
    const result = executeActivateEmptyBedController({
      bedId: 'R9',
      runtime: {
        updatePatient: vi.fn(),
        requestFrame: callback => callback(),
        querySelector: () => null,
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        outcome: 'input_not_found',
        selector: '[data-bed-id="R9"] input[name="patientName"]',
      },
    });
  });

  it('falls back to immediate focus and still opens demographics when requestFrame throws', () => {
    document.body.innerHTML = `
          <div data-bed-id="R4">
            <input name="patientName" value="tmp" />
            <button title="Datos del Paciente">Abrir</button>
          </div>
        `;
    const clickSpy = vi.fn();
    document
      .querySelector('[data-bed-id="R4"] [title="Datos del Paciente"]')
      ?.addEventListener('click', clickSpy);

    const result = executeActivateEmptyBedController({
      bedId: 'R4',
      runtime: {
        updatePatient: vi.fn(),
        requestFrame: () => {
          throw new Error('raf failed');
        },
        querySelector: selector => document.querySelector(selector),
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outcome).toBe('focused');
    }
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('retries across frames until the new row is mounted', () => {
    const updatePatient = vi.fn();
    const clickSpy = vi.fn();
    let frameCount = 0;

    const result = executeActivateEmptyBedController({
      bedId: 'R7',
      runtime: {
        updatePatient,
        requestFrame: callback => {
          frameCount += 1;
          if (frameCount === 2) {
            document.body.innerHTML = `
                          <div data-bed-id="R7">
                            <input name="patientName" value="tmp" />
                            <button title="Datos del Paciente">Abrir</button>
                          </div>
                        `;
            document
              .querySelector('[data-bed-id="R7"] [title="Datos del Paciente"]')
              ?.addEventListener('click', clickSpy);
          }
          callback();
        },
        querySelector: selector => document.querySelector(selector),
      },
    });

    expect(updatePatient).toHaveBeenCalledWith('R7', 'patientName', ' ');
    expect(frameCount).toBeGreaterThan(1);
    expect(result.ok).toBe(true);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-bed-id="R7"] input[name="patientName"]')).toHaveProperty(
      'value',
      ''
    );
  });
});
