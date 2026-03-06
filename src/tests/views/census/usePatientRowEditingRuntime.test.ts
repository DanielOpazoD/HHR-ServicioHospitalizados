import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePatientRowHandlersModel } from '@/features/census/components/patient-row/usePatientRowHandlersModel';
import { usePatientRowEditingRuntime } from '@/features/census/components/patient-row/usePatientRowEditingRuntime';

vi.mock('@/features/census/components/patient-row/usePatientRowHandlersModel', () => ({
  usePatientRowHandlersModel: vi.fn(),
}));

describe('usePatientRowEditingRuntime', () => {
  it('delegates editing composition to handlers model with same contract', () => {
    const composed = {
      handlers: {
        mainInputChangeHandlers: {} as never,
        cribInputChangeHandlers: {} as never,
      },
      modalSavers: {
        onSaveDemographics: vi.fn(),
        onSaveCribDemographics: vi.fn(),
      },
    };
    vi.mocked(usePatientRowHandlersModel).mockReturnValue(composed);

    const updatePatient = vi.fn();
    const updatePatientMultiple = vi.fn();
    const updateClinicalCrib = vi.fn();
    const updateClinicalCribMultiple = vi.fn();

    const { result } = renderHook(() =>
      usePatientRowEditingRuntime({
        bedId: 'R1',
        documentType: 'RUT',
        updatePatient,
        updatePatientMultiple,
        updateClinicalCrib,
        updateClinicalCribMultiple,
      })
    );

    expect(usePatientRowHandlersModel).toHaveBeenCalledWith({
      bedId: 'R1',
      documentType: 'RUT',
      updatePatient,
      updatePatientMultiple,
      updateClinicalCrib,
      updateClinicalCribMultiple,
    });
    expect(result.current).toBe(composed);
  });
});
