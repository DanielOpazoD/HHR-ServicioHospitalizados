import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OccupiedBedRow } from '@/features/census/types/censusTableTypes';
import { useClinicalDocumentPresenceByBed } from '@/features/census/hooks/useClinicalDocumentPresenceByBed';
import { executeListClinicalDocumentsByEpisodeKeys } from '@/application/clinical-documents/clinicalDocumentUseCases';
import { createQueryClientTestWrapper } from '@/tests/utils/queryClientTestUtils';
import { BedType } from '@/types';

const warnMock = vi.hoisted(() => vi.fn());

vi.mock('@/application/clinical-documents/clinicalDocumentUseCases', () => ({
  executeListClinicalDocumentsByEpisodeKeys: vi.fn(),
}));

vi.mock('@/services/utils/loggerService', () => ({
  logger: {
    child: () => ({
      warn: warnMock,
    }),
  },
}));

describe('useClinicalDocumentPresenceByBed', () => {
  const occupiedRows: OccupiedBedRow[] = [
    {
      id: 'row-r1',
      bed: { id: 'R1', name: 'R1', type: BedType.MEDIA, isCuna: false },
      data: {
        patientName: 'Paciente',
        rut: '1-9',
        admissionDate: '2026-03-05',
      },
      isSubRow: false,
    } as OccupiedBedRow,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(executeListClinicalDocumentsByEpisodeKeys).mockResolvedValue({
      status: 'success',
      data: [],
      issues: [],
    });
  });

  it('does not query clinical documents when disabled', () => {
    const { wrapper } = createQueryClientTestWrapper();
    const { result } = renderHook(
      () =>
        useClinicalDocumentPresenceByBed({
          occupiedRows,
          currentDateString: '2026-03-05',
          enabled: false,
        }),
      { wrapper }
    );

    expect(result.current).toEqual({});
    expect(executeListClinicalDocumentsByEpisodeKeys).not.toHaveBeenCalled();
  });

  it('returns empty fallback when the query fails', async () => {
    vi.mocked(executeListClinicalDocumentsByEpisodeKeys).mockRejectedValueOnce(new Error('denied'));
    const { wrapper } = createQueryClientTestWrapper();

    const { result } = renderHook(
      () =>
        useClinicalDocumentPresenceByBed({
          occupiedRows,
          currentDateString: '2026-03-05',
          enabled: true,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(executeListClinicalDocumentsByEpisodeKeys).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current).toEqual({ R1: false });
    });

    expect(warnMock).toHaveBeenCalled();
  });

  it('prefers userSafeMessage when the presence listing fails with a typed outcome', async () => {
    vi.mocked(executeListClinicalDocumentsByEpisodeKeys).mockResolvedValueOnce({
      status: 'failed',
      data: [],
      userSafeMessage: 'La presencia documental no está disponible temporalmente.',
      issues: [{ kind: 'unknown', message: 'raw failure' }],
    });
    const { wrapper } = createQueryClientTestWrapper();

    renderHook(
      () =>
        useClinicalDocumentPresenceByBed({
          occupiedRows,
          currentDateString: '2026-03-05',
          enabled: true,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(warnMock).toHaveBeenCalledWith(
        'Failed to resolve clinical document presence',
        'La presencia documental no está disponible temporalmente.'
      );
    });
  });
});
