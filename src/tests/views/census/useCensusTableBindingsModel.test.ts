import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCensusTableBindingsModel } from '@/features/census/hooks/useCensusTableBindingsModel';
import { useCensusTableViewModel } from '@/features/census/hooks/useCensusTableViewModel';
import { useClinicalDocumentPresenceByBed } from '@/features/census/hooks/useClinicalDocumentPresenceByBed';
import { buildCensusTableLayoutBindings } from '@/features/census/controllers/censusTableLayoutController';

vi.mock('@/features/census/hooks/useCensusTableViewModel', () => ({
  useCensusTableViewModel: vi.fn(),
}));

vi.mock('@/features/census/hooks/useClinicalDocumentPresenceByBed', () => ({
  useClinicalDocumentPresenceByBed: vi.fn(),
}));

vi.mock('@/features/census/controllers/censusTableLayoutController', () => ({
  buildCensusTableLayoutBindings: vi.fn(),
}));

const asHookValue = <T>(value: Partial<T>): T => value as T;

describe('useCensusTableBindingsModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns not-ready when the base table model has no beds payload yet', () => {
    vi.mocked(useCensusTableViewModel).mockReturnValue(
      asHookValue<ReturnType<typeof useCensusTableViewModel>>({
        beds: null,
        unifiedRows: [],
        role: 'viewer',
      })
    );
    vi.mocked(useClinicalDocumentPresenceByBed).mockReturnValue({
      byBedId: {},
      infoByBedId: {},
    });

    const { result } = renderHook(() =>
      useCensusTableBindingsModel({
        currentDateString: '2026-03-10',
      })
    );

    expect(result.current.isReady).toBe(false);
    expect(result.current.bindings).toBeNull();
    expect(buildCensusTableLayoutBindings).not.toHaveBeenCalled();
  });

  it('builds final table bindings from the view model and document presence map', () => {
    const layoutBindings = {
      headerProps: { readOnly: false },
      bodyProps: { currentDateString: '2026-03-10' },
      tableStyle: { width: '1200px', minWidth: '100%' },
    };

    vi.mocked(useCensusTableViewModel).mockReturnValue(
      asHookValue<ReturnType<typeof useCensusTableViewModel>>({
        beds: {},
        columns: {} as never,
        isEditMode: false,
        canDeleteRecord: true,
        resetDayDeniedMessage: '',
        unifiedRows: [],
        bedTypes: {},
        totalWidth: 1200,
        handleClearAll: vi.fn(),
        diagnosisMode: 'free',
        toggleDiagnosisMode: vi.fn(),
        handleRowAction: vi.fn(),
        activateEmptyBed: vi.fn(),
        handleColumnResize: vi.fn(),
        role: 'doctor_urgency',
      })
    );
    vi.mocked(useClinicalDocumentPresenceByBed).mockReturnValue({
      byBedId: { R1: true },
      infoByBedId: { R1: { present: true, totalCount: 1, draftCount: 0 } },
    });
    vi.mocked(buildCensusTableLayoutBindings).mockReturnValue(layoutBindings as never);

    const { result } = renderHook(() =>
      useCensusTableBindingsModel({
        currentDateString: '2026-03-10',
      })
    );

    expect(useClinicalDocumentPresenceByBed).toHaveBeenCalledWith({
      unifiedRows: [],
      currentDateString: '2026-03-10',
      enabled: true,
    });
    expect(buildCensusTableLayoutBindings).toHaveBeenCalledWith(
      expect.objectContaining({
        currentDateString: '2026-03-10',
        clinicalDocumentPresenceByBedId: { R1: true },
        totalWidth: 1200,
      })
    );
    expect(result.current.isReady).toBe(true);
    expect(result.current.bindings).toBe(layoutBindings);
    expect(result.current.clinicalDocumentInfoByBedId).toEqual({
      R1: { present: true, totalCount: 1, draftCount: 0 },
    });
  });
});
