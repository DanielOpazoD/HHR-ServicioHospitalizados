import { describe, expect, it } from 'vitest';
import { collectExamFinding } from '@/features/laboratory/controllers/labFindingCollectionController';
import type { DetailProcessingContext } from '@/features/laboratory/controllers/labAnalyticsContracts';
import type { LabMicrobiologyCategory, LabResultRow } from '@/types/domain/laboratory';

const buildContext = (
  overrides: Partial<DetailProcessingContext> = {}
): DetailProcessingContext => ({
  exam: undefined,
  examDate: '06/04/2026',
  colKey: '06/04/2026 11:40',
  comparison: {},
  trendMap: {},
  seenTrend: new Set(),
  seenComparison: new Set(),
  bilirubinByCol: {},
  isoDate: '2026-04-06',
  microbiologyCategories: [],
  microbiologyFindingsByCategory: new Map(),
  ...overrides,
});

describe('labFindingCollectionController', () => {
  it('collects numeric findings into comparison and trend maps', () => {
    const context = buildContext();
    const finding: LabResultRow = {
      section: 'HEMOGRAMA',
      analysis: 'Hemoglobina',
      result: '14,2',
      unit: 'g/dL',
      refValue: '12-16',
    };

    collectExamFinding(finding, context);

    expect(context.comparison.Hemoglobina?.['06/04/2026 11:40']?.result).toBe('14,2');
    expect(context.trendMap.Hemoglobina).toHaveLength(1);
    expect(context.trendMap.Hemoglobina?.[0]?.value).toBe(14.2);
  });

  it('routes microbiology findings to their category map without contaminating trends', () => {
    const findingsByCategory = new Map<
      LabMicrobiologyCategory,
      Array<{ analysis: string; result: string }>
    >();
    const context = buildContext({
      microbiologyCategories: ['pcr_panel_respiratorio'],
      microbiologyFindingsByCategory: findingsByCategory,
    });
    const finding: LabResultRow = {
      section: 'MICRO',
      analysis: 'Rhinovirus',
      result: 'NEGATIVO',
      unit: '',
      refValue: '',
      qualitative: true,
    };

    collectExamFinding(finding, context);

    expect(findingsByCategory.get('pcr_panel_respiratorio')).toEqual([
      { analysis: 'Rhinovirus', result: 'NEGATIVO' },
    ]);
    expect(context.trendMap.Rhinovirus).toBeUndefined();
  });
});
