import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OccupiedBedRow } from '@/features/census/types/censusTableTypes';
import { useClinicalDocumentPresenceByBed } from '@/features/census/hooks/useClinicalDocumentPresenceByBed';
import { ClinicalDocumentRepository } from '@/services/repositories/ClinicalDocumentRepository';
import { createQueryClientTestWrapper } from '@/tests/utils/queryClientTestUtils';
import { BedType } from '@/types';

vi.mock('@/services/repositories/ClinicalDocumentRepository', () => ({
  ClinicalDocumentRepository: {
    listByEpisodeKeys: vi.fn(),
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
    expect(ClinicalDocumentRepository.listByEpisodeKeys).not.toHaveBeenCalled();
  });

  it('returns empty fallback when the query fails', async () => {
    vi.mocked(ClinicalDocumentRepository.listByEpisodeKeys).mockRejectedValueOnce(
      new Error('denied')
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
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
      expect(ClinicalDocumentRepository.listByEpisodeKeys).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current).toEqual({});
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
