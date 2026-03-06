import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePatientRowUiState } from '@/features/census/components/patient-row/usePatientRowUiState';
import { usePatientRowBedConfigActions } from '@/features/census/components/patient-row/usePatientRowBedConfigActions';
import { usePatientRowInteractionRuntime } from '@/features/census/components/patient-row/usePatientRowInteractionRuntime';
import { DataFactory } from '@/tests/factories/DataFactory';

vi.mock('@/features/census/components/patient-row/usePatientRowUiState', () => ({
  usePatientRowUiState: vi.fn(),
}));

vi.mock('@/features/census/components/patient-row/usePatientRowBedConfigActions', () => ({
  usePatientRowBedConfigActions: vi.fn(),
}));

const asHookValue = <T>(value: Partial<T>): T => value as T;

describe('usePatientRowInteractionRuntime', () => {
  const onAction = vi.fn();
  const toggleBedType = vi.fn();
  const updateClinicalCrib = vi.fn();
  const data = DataFactory.createMockPatient('R1');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePatientRowUiState).mockReturnValue(
      asHookValue<ReturnType<typeof usePatientRowUiState>>({
        showDemographics: false,
        showClinicalDocuments: false,
        showExamRequest: false,
        showImagingRequest: false,
        showHistory: false,
        openDemographics: vi.fn(),
        closeDemographics: vi.fn(),
        openClinicalDocuments: vi.fn(),
        closeClinicalDocuments: vi.fn(),
        openExamRequest: vi.fn(),
        closeExamRequest: vi.fn(),
        openImagingRequest: vi.fn(),
        closeImagingRequest: vi.fn(),
        openHistory: vi.fn(),
        closeHistory: vi.fn(),
      })
    );
    vi.mocked(usePatientRowBedConfigActions).mockReturnValue(
      asHookValue<ReturnType<typeof usePatientRowBedConfigActions>>({
        toggleBedMode: vi.fn(),
        toggleCompanionCrib: vi.fn(),
        toggleClinicalCrib: vi.fn(),
      })
    );
  });

  it('builds action dispatcher and bed type toggles with bed-scoped wiring', () => {
    const { result } = renderHook(() =>
      usePatientRowInteractionRuntime({
        bedId: 'R1',
        data,
        onAction,
        rowState: {
          isCunaMode: false,
          hasCompanion: false,
          hasClinicalCrib: false,
        },
        updatePatient: vi.fn(),
        updateClinicalCrib,
        toggleBedType,
        confirm: vi.fn(),
        alert: vi.fn(),
      })
    );

    act(() => {
      result.current.handleAction('move');
      result.current.bedTypeToggles.onToggleBedType();
      result.current.bedTypeToggles.onUpdateClinicalCrib('remove');
    });

    expect(onAction).toHaveBeenCalledWith('move', 'R1', data);
    expect(toggleBedType).toHaveBeenCalledWith('R1');
    expect(updateClinicalCrib).toHaveBeenCalledWith('R1', 'remove');
  });
});
