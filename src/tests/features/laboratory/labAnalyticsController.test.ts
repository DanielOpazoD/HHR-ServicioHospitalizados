/**
 * @fileoverview Unit tests for labAnalyticsController.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/utils/loggerScope', () => ({
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  isTrendVariable,
  isExcludedFromComparison,
  comparisonSortIndex,
  buildExamColumnKey,
  buildAnalysisData,
} from '@/features/laboratory/controllers/labAnalyticsController';
import type { SyslabExamItem, SyslabExamDetail } from '@/types/domain/laboratory';

/* ================================================================== */
/*  isTrendVariable                                                    */
/* ================================================================== */

describe('isTrendVariable', () => {
  it('returns true for "Hemoglobina"', () => {
    expect(isTrendVariable('Hemoglobina')).toBe(true);
  });

  it('returns true for "ASAT/GOT"', () => {
    expect(isTrendVariable('ASAT/GOT')).toBe(true);
  });

  it('returns false for "FooBar"', () => {
    expect(isTrendVariable('FooBar')).toBe(false);
  });
});

/* ================================================================== */
/*  isExcludedFromComparison                                           */
/* ================================================================== */

describe('isExcludedFromComparison', () => {
  it('returns true for "Baciliformes"', () => {
    expect(isExcludedFromComparison('Baciliformes')).toBe(true);
  });

  it('returns false for "Proteina C Reactiva" (OT bug fix)', () => {
    // "Proteina C Reactiva" should NOT be excluded — the ", OT" entry
    // in COMPARISON_EXCLUDE must not match "Reactiva" or partial strings.
    expect(isExcludedFromComparison('Proteina C Reactiva')).toBe(false);
  });

  it('returns true for "VLDL"', () => {
    expect(isExcludedFromComparison('VLDL')).toBe(true);
  });
});

/* ================================================================== */
/*  comparisonSortIndex                                                */
/* ================================================================== */

describe('comparisonSortIndex', () => {
  it('Hemoglobina comes before Creatinina', () => {
    expect(comparisonSortIndex('Hemoglobina')).toBeLessThan(comparisonSortIndex('Creatinina'));
  });

  it('Creatinina comes before ASAT/GOT', () => {
    expect(comparisonSortIndex('Creatinina')).toBeLessThan(comparisonSortIndex('ASAT/GOT'));
  });

  it('unknown variable gets max+1 index', () => {
    const unknown = comparisonSortIndex('UnknownVariable');
    const known = comparisonSortIndex('Hemoglobina');
    expect(unknown).toBeGreaterThan(known);
  });
});

/* ================================================================== */
/*  buildExamColumnKey                                                 */
/* ================================================================== */

describe('buildExamColumnKey', () => {
  it('uses date + time when time is available', () => {
    const exam: SyslabExamItem = {
      id: '123',
      link: 'http://example.com',
      date: '06/04/2026',
      time: '13:08:43',
      patientName: 'TEST',
      origin: 'HOSP',
      exams: [],
    };
    expect(buildExamColumnKey(exam, '06/04/2026')).toBe('06/04/2026 13:08');
  });

  it('uses date + id fallback when no time', () => {
    const exam: SyslabExamItem = {
      id: '456',
      link: 'http://example.com',
      date: '06/04/2026',
      time: '',
      patientName: 'TEST',
      origin: 'HOSP',
      exams: [],
    };
    expect(buildExamColumnKey(exam, '06/04/2026')).toBe('06/04/2026 (#456)');
  });

  it('returns fallbackDate when exam is undefined', () => {
    expect(buildExamColumnKey(undefined, '01/01/2026')).toBe('01/01/2026');
  });
});

/* ================================================================== */
/*  buildAnalysisData                                                  */
/* ================================================================== */

describe('buildAnalysisData', () => {
  const examWithTime: SyslabExamItem = {
    id: '100',
    link: 'http://example.com/100',
    date: '06/04/2026',
    time: '10:00:00',
    patientName: 'TEST',
    origin: 'HOSP',
    exams: ['HEMOGRAMA'],
  };

  const examWithTime2: SyslabExamItem = {
    id: '200',
    link: 'http://example.com/200',
    date: '01/03/2026',
    time: '09:00:00',
    patientName: 'TEST',
    origin: 'HOSP',
    exams: ['HEMOGRAMA'],
  };

  it('merges bilirrubina Total + Directa into T/D/I row', () => {
    const details: SyslabExamDetail[] = [
      {
        url: 'http://example.com/100',
        findings: [
          {
            section: 'HEPATICO',
            analysis: 'Bilirrubina Total',
            result: '1.2',
            unit: 'mg/dL',
            refValue: '',
          },
          {
            section: 'HEPATICO',
            analysis: 'Bilirrubina Directa',
            result: '0.3',
            unit: 'mg/dL',
            refValue: '',
          },
        ],
      },
    ];
    const result = buildAnalysisData(details, [examWithTime]);
    expect(result.comparison['Bilirrubinas (T/D/I)']).toBeDefined();
    const col = Object.values(result.comparison['Bilirrubinas (T/D/I)'])[0];
    expect(col.result).toContain('1.2');
    expect(col.result).toContain('0.3');
  });

  it('excludes Baciliformes from comparison but keeps Hemoglobina', () => {
    const details: SyslabExamDetail[] = [
      {
        url: 'http://example.com/100',
        findings: [
          {
            section: 'HEMOGRAMA',
            analysis: 'Hemoglobina',
            result: '14',
            unit: 'g/dL',
            refValue: '12-16',
          },
          {
            section: 'HEMOGRAMA',
            analysis: 'Baciliformes',
            result: '0',
            unit: '%',
            refValue: '0-2',
          },
        ],
      },
    ];
    const result = buildAnalysisData(details, [examWithTime]);
    expect(result.comparison['Hemoglobina']).toBeDefined();
    expect(result.comparison['Baciliformes']).toBeUndefined();
  });

  it('orders Hemoglobina before Creatinina before ASAT/GOT in comparison', () => {
    const details: SyslabExamDetail[] = [
      {
        url: 'http://example.com/100',
        findings: [
          { section: 'RENAL', analysis: 'ASAT/GOT', result: '25', unit: 'U/L', refValue: '10-40' },
          {
            section: 'RENAL',
            analysis: 'Creatinina',
            result: '0.9',
            unit: 'mg/dL',
            refValue: '0.6-1.2',
          },
          {
            section: 'HEMOGRAMA',
            analysis: 'Hemoglobina',
            result: '14',
            unit: 'g/dL',
            refValue: '12-16',
          },
        ],
      },
    ];
    const result = buildAnalysisData(details, [examWithTime]);
    const keys = Object.keys(result.comparison);
    const hbIdx = keys.indexOf('Hemoglobina');
    const crIdx = keys.indexOf('Creatinina');
    const asatIdx = keys.indexOf('ASAT/GOT');
    expect(hbIdx).toBeLessThan(crIdx);
    expect(crIdx).toBeLessThan(asatIdx);
  });

  it('deduplicates same variable+date (only counted once)', () => {
    const details: SyslabExamDetail[] = [
      {
        url: 'http://example.com/100',
        findings: [
          {
            section: 'HEMOGRAMA',
            analysis: 'Hemoglobina',
            result: '14',
            unit: 'g/dL',
            refValue: '12-16',
          },
          {
            section: 'HEMOGRAMA',
            analysis: 'Hemoglobina',
            result: '14',
            unit: 'g/dL',
            refValue: '12-16',
          },
        ],
      },
      {
        url: 'http://example.com/200',
        findings: [
          {
            section: 'HEMOGRAMA',
            analysis: 'Hemoglobina',
            result: '13',
            unit: 'g/dL',
            refValue: '12-16',
          },
        ],
      },
    ];
    const result = buildAnalysisData(details, [examWithTime, examWithTime2]);
    const hbGroup = result.trendGroups.find(g => g.variables['Hemoglobina']);
    // 2 unique date points, not 3
    expect(hbGroup!.variables['Hemoglobina']).toHaveLength(2);
  });

  it('returns empty result for empty details array', () => {
    const result = buildAnalysisData([], []);
    expect(result.trendGroups).toEqual([]);
    expect(result.examDates).toEqual([]);
    expect(result.comparison).toEqual({});
  });
});
