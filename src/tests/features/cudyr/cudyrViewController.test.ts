import { describe, expect, it } from 'vitest';

import { buildCudyrViewShellModel } from '@/features/cudyr/controllers/cudyrViewController';

describe('cudyrViewController', () => {
  it('builds print-friendly shell values for date, nurses and categorization index', () => {
    expect(
      buildCudyrViewShellModel({
        recordDate: '2026-04-15',
        responsibleNurses: ['Ana', 'Bea'],
        occupiedCount: 10,
        categorizedCount: 8,
      })
    ).toEqual({
      formattedPrintDate: '15-04-2026',
      responsibleNursesLabel: 'Ana, Bea',
      hasResponsibleNurses: true,
      categorizationIndex: 80,
    });
  });

  it('keeps safe fallback values when there are no nurses or occupied beds', () => {
    expect(
      buildCudyrViewShellModel({
        recordDate: '2026-04-15',
        responsibleNurses: [],
        occupiedCount: 0,
        categorizedCount: 0,
      })
    ).toEqual({
      formattedPrintDate: '15-04-2026',
      responsibleNursesLabel: '',
      hasResponsibleNurses: false,
      categorizationIndex: 0,
    });
  });
});
