import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIEEHForm } from '@/features/census/hooks/useIEEHForm';
import { printIEEHForm } from '@/services/pdf/ieehPdfService';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntimeCore';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';

vi.mock('@/services/pdf/ieehPdfService', () => ({
  printIEEHForm: vi.fn(),
}));

vi.mock('@/services/terminology/terminologyService', () => ({
  searchDiagnoses: vi.fn().mockResolvedValue([]),
  forceAISearch: vi.fn().mockResolvedValue([]),
}));

const mockOpen = vi.spyOn(defaultBrowserWindowRuntime, 'open');

describe('useIEEHForm', () => {
  const patient = {
    bedId: '1',
    isBlocked: false,
    bedMode: 'Cama' as const,
    hasCompanionCrib: false,
    patientName: 'JUAN PEREZ',
    rut: '12345678-9',
    age: '30',
    pathology: 'DIAGNOSTICO BASE',
    cie10Code: 'A00',
    cie10Description: 'DESC CIE10 BASE',
    specialty: Specialty.MEDICINA,
    status: PatientStatus.ESTABLE,
    admissionDate: '01-01-2024',
    admissionTime: '10:00',
    insurance: 'Fonasa' as const,
    admissionOrigin: 'Urgencias' as const,
    hasWristband: false,
    devices: [],
    surgicalComplication: false,
    isUPC: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOpen.mockReturnValue({ close: vi.fn() } as unknown as Window);
    vi.mocked(printIEEHForm).mockResolvedValue(undefined);
  });

  it('persists default No values for surgery and procedure on print', async () => {
    const onClose = vi.fn();
    const onSaveData = vi.fn();
    const { result } = renderHook(() =>
      useIEEHForm({
        isOpen: true,
        onClose,
        patient,
        baseDischargeData: {
          dischargeDate: '02-01-2024',
          dischargeTime: '11:00',
        },
        onSaveData,
      })
    );

    await act(async () => {
      await result.current.actions.handleGenerate();
    });

    expect(onSaveData).toHaveBeenCalledWith(
      expect.objectContaining({
        intervencionQuirurgica: '2',
        procedimiento: '2',
      })
    );
    expect(printIEEHForm).toHaveBeenCalledWith(
      patient,
      expect.objectContaining({
        intervencionQuirurgica: '2',
        procedimiento: '2',
      }),
      expect.any(Object)
    );
  });
});
