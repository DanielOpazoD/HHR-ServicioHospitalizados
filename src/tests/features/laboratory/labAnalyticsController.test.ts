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

  it('tracks trends for RPC and RAC but not urine density', () => {
    const urineExamOne: SyslabExamItem = {
      id: '500',
      link: 'http://example.com/500',
      date: '10/04/2026',
      time: '08:00:00',
      patientName: 'TEST',
      origin: 'HOSP',
      exams: ['QUIMICA/ORINA'],
    };
    const urineExamTwo: SyslabExamItem = {
      id: '501',
      link: 'http://example.com/501',
      date: '20/04/2026',
      time: '08:00:00',
      patientName: 'TEST',
      origin: 'HOSP',
      exams: ['QUIMICA/ORINA'],
    };

    const result = buildAnalysisData(
      [
        {
          url: urineExamOne.link!,
          findings: [
            {
              section: 'QUIMICA/ORINA',
              analysis: 'Rel. Proteinuria/Creatininuria',
              result: '120',
              unit: '',
              refValue: '< 200,0',
            },
            {
              section: 'RELAC. ALBUMINA/CREATINURIA',
              analysis: 'RELAC. ALBUMINA/CREATINURIA',
              result: '35',
              unit: '',
              refValue: '< 30,0',
            },
            {
              section: 'ORINA FISICO-QUIMICO',
              analysis: 'Densidad',
              result: '1,015',
              unit: '',
              refValue: '',
            },
          ],
        },
        {
          url: urineExamTwo.link!,
          findings: [
            {
              section: 'QUIMICA/ORINA',
              analysis: 'Rel. Proteinuria/Creatininuria',
              result: '90',
              unit: '',
              refValue: '< 200,0',
            },
            {
              section: 'RELAC. ALBUMINA/CREATINURIA',
              analysis: 'RELAC. ALBUMINA/CREATINURIA',
              result: '28',
              unit: '',
              refValue: '< 30,0',
            },
            {
              section: 'ORINA FISICO-QUIMICO',
              analysis: 'Densidad',
              result: '1,010',
              unit: '',
              refValue: '',
            },
          ],
        },
      ],
      [urineExamOne, urineExamTwo]
    );

    const urineTrendGroup = result.trendGroups.find(group => group.label === 'RPC / RAC');
    expect(urineTrendGroup?.variables.RPC).toHaveLength(2);
    expect(urineTrendGroup?.variables.RAC).toHaveLength(2);
    expect(urineTrendGroup?.variables.Densidad).toBeUndefined();
  });

  it('separates microbiology categories from one combined exam without mixing culture and PCR rows', () => {
    const combinedExam: SyslabExamItem = {
      id: '43091284',
      link: 'http://example.com/43091284',
      date: '06/04/2026',
      time: '11:40:00',
      patientName: 'TEST',
      origin: 'HOSP',
      exams: [
        'CULTIVO CORRIENTE 1',
        'ATB BACILOS GRAM (-) 1',
        'ANTIBIOGRAMA EXTENDIDO 1',
        'PCR PANEL RESPIRATORIO #2',
      ],
    };

    const details: SyslabExamDetail[] = [
      {
        url: 'http://example.com/43091284',
        findings: [
          {
            section: 'MICRO',
            analysis: 'Cultivo',
            result: 'Bacilos Gram (-) No Fermentador',
            unit: '',
            refValue: '',
            qualitative: true,
          },
          {
            section: 'MICRO',
            analysis: 'Ceftazidima',
            result: 'Susceptible',
            unit: '',
            refValue: '',
            qualitative: true,
          },
          {
            section: 'MICRO',
            analysis: 'Rhinovirus',
            result: 'NEGATIVO',
            unit: '',
            refValue: '',
            qualitative: true,
          },
        ],
      },
    ];

    const result = buildAnalysisData(details, [combinedExam]);
    const cultivo = result.microbiologyEntries.find(entry => entry.examLabel === 'Otros cultivos');
    const pcr = result.microbiologyEntries.find(entry => entry.examLabel === 'PCR 8 virus');

    expect(cultivo?.findings).toEqual(
      expect.arrayContaining([
        { analysis: 'Cultivo', result: 'Bacilos Gram (-) No Fermentador' },
        { analysis: 'Ceftazidima', result: 'Susceptible' },
      ])
    );
    expect(cultivo?.findings).not.toEqual(
      expect.arrayContaining([{ analysis: 'Rhinovirus', result: 'NEGATIVO' }])
    );
    expect(pcr?.findings).toEqual(
      expect.arrayContaining([{ analysis: 'Rhinovirus', result: 'NEGATIVO' }])
    );
  });

  it('surfaces arbovirus PCR as a separate microbiology card', () => {
    const arbovirusExam: SyslabExamItem = {
      id: '43088963',
      link: 'http://example.com/43088963',
      date: '16/02/2026',
      time: '15:19:41',
      patientName: 'TEST',
      origin: 'URG',
      exams: ['PCR ARBOVIROSIS'],
    };

    const result = buildAnalysisData(
      [
        {
          url: arbovirusExam.link!,
          findings: [
            {
              section: 'MICROBIOLOGIA',
              analysis: 'PCR virus Zika',
              result: 'Negativo',
              unit: '',
              refValue: '',
              qualitative: true,
            },
            {
              section: 'MICROBIOLOGIA',
              analysis: 'PCR DENGUE',
              result: 'Negativo',
              unit: '',
              refValue: '',
              qualitative: true,
            },
          ],
        },
      ],
      [arbovirusExam]
    );

    expect(result.microbiologyEntries.map(entry => entry.examLabel)).toEqual(['PCR arbovirus']);
    expect(result.microbiologyEntries[0]?.findings).toEqual([
      { analysis: 'PCR virus Zika', result: 'Negativo' },
      { analysis: 'PCR DENGUE', result: 'Negativo' },
    ]);
  });

  it('prioritizes RPC and RAC over component urine support values', () => {
    const urineExam: SyslabExamItem = {
      id: '43091921',
      link: 'http://example.com/43091921',
      date: '19/04/2026',
      time: '20:30:45',
      patientName: 'TEST',
      origin: 'HOSP',
      exams: ['ORINA FISICO-QUIMICO', 'SEDIMENTO URINARIO', 'QUIMICA/ORINA'],
    };

    const result = buildAnalysisData(
      [
        {
          url: urineExam.link!,
          findings: [
            {
              section: 'ORINA FISICO-QUIMICO',
              analysis: 'Leucocitos',
              result: '+/-',
              unit: '',
              refValue: '',
            },
            {
              section: 'SEDIMENTO URINARIO',
              analysis: 'Bacterias',
              result: 'Escasa cantidad',
              unit: '',
              refValue: '',
            },
            {
              section: 'SEDIMENTO URINARIO',
              analysis: 'Placas de pus',
              result: 'No se observa',
              unit: '',
              refValue: '',
            },
            {
              section: 'QUIMICA/ORINA',
              analysis: 'Rel. Proteinuria/Creatininuria',
              result: '136,2',
              unit: '',
              refValue: '< 200,0',
            },
            {
              section: 'QUIMICA/ORINA',
              analysis: 'Proteinuria',
              result: '126',
              unit: 'mg/L',
              refValue: '10 - 140',
            },
            {
              section: 'QUIMICA/ORINA',
              analysis: 'Creatininuria',
              result: '92,5',
              unit: 'mg/dL',
              refValue: '70,0 - 140,0',
            },
            {
              section: 'RELAC. ALBUMINA/CREATINURIA',
              analysis: 'Relacion Albumina/Creatininuri',
              result: '238,9',
              unit: '',
              refValue: '< 30,0',
            },
            {
              section: 'RELAC. ALBUMINA/CREATINURIA',
              analysis: 'Microalbuminuria',
              result: '221',
              unit: 'mg/L',
              refValue: '< 250',
            },
          ],
        },
      ],
      [urineExam]
    );

    expect(result.comparison.RPC).toBeDefined();
    expect(result.comparison.RAC).toBeDefined();
    expect(result.comparison.Leucocitos).toBeUndefined();
    expect(result.comparison.Bacterias).toBeUndefined();
    expect(result.comparison['Placas de pus']).toBeUndefined();
    expect(result.comparison.Proteinuria).toBeUndefined();
    expect(result.comparison.Creatininuria).toBeUndefined();
    expect(result.comparison.Microalbuminuria).toBeUndefined();
    expect(result.comparison.Leucocitos).toBeUndefined();
  });

  it('excludes urine qualitative rows and MIDAS metadata from comparison while keeping RPC/RAC', () => {
    const urineExam: SyslabExamItem = {
      id: '43091921',
      link: 'http://example.com/43091921',
      date: '19/04/2026',
      time: '19:55:00',
      patientName: 'TEST',
      origin: 'HOSP',
      exams: ['ORINA FISICO-QUIMICO', 'QUIMICA/ORINA'],
    };

    const result = buildAnalysisData(
      [
        {
          url: urineExam.link!,
          findings: [
            {
              section: 'GENERAL',
              analysis: 'N° ingreso a MIDAS',
              result: '2605786',
              unit: '',
              refValue: '',
            },
            {
              section: 'GENERAL',
              analysis: 'Leucocitos',
              result: 'Negativo',
              unit: '',
              refValue: '',
              qualitative: true,
            },
            {
              section: 'GENERAL',
              analysis: 'Cuerpos Cetónicos',
              result: 'Negativo',
              unit: '',
              refValue: '',
              qualitative: true,
            },
            {
              section: 'GENERAL',
              analysis: 'Nitritos',
              result: 'Negativo',
              unit: '',
              refValue: '',
              qualitative: true,
            },
            {
              section: 'GENERAL',
              analysis: 'Rel. Proteinuria/Creatininuria',
              result: '136,2',
              unit: '',
              refValue: '< 200,0',
            },
            {
              section: 'GENERAL',
              analysis: 'RELAC. ALBUMINA/CREATINURIA',
              result: '238,9',
              unit: '',
              refValue: '< 30,0',
            },
            {
              section: 'GENERAL',
              analysis: 'Creatininuria',
              result: '92,5',
              unit: 'mg/dL',
              refValue: '70,0 - 140,0',
            },
            {
              section: 'GENERAL',
              analysis: 'Proteinuria',
              result: '126',
              unit: 'mg/L',
              refValue: '10 - 140',
            },
            {
              section: 'GENERAL',
              analysis: 'Microalbuminuria',
              result: '221',
              unit: 'mg/L',
              refValue: '< 250',
            },
          ],
        },
      ],
      [urineExam]
    );

    expect(result.comparison['N° ingreso a MIDAS']).toBeUndefined();
    expect(result.comparison['Recuento Leucocitos']).toBeUndefined();
    expect(result.comparison['Cuerpos Cetónicos']).toBeUndefined();
    expect(result.comparison.Nitritos).toBeUndefined();
    expect(result.comparison.Creatininuria).toBeUndefined();
    expect(result.comparison.Proteinuria).toBeUndefined();
    expect(result.comparison.Microalbuminuria).toBeUndefined();
    expect(result.comparison.RPC).toBeDefined();
    expect(result.comparison.RAC).toBeDefined();
  });

  it('excludes real urine-complete header rows and MIDAS metadata from exam 43091921 style details', () => {
    const urineExam: SyslabExamItem = {
      id: '43091921',
      link: 'http://example.com/43091921',
      date: '19/04/2026',
      time: '19:55:00',
      patientName: 'TEST',
      origin: 'HOSP',
      exams: ['ORINA FISICO-QUIMICO', 'SEDIMENTO URINARIO', 'QUIMICA/ORINA'],
    };

    const result = buildAnalysisData(
      [
        {
          url: urineExam.link!,
          findings: [
            {
              section: 'GENERAL',
              analysis: 'ORINA FISICO-QUIMICO',
              result: '',
              unit: '',
              refValue: '',
            },
            {
              section: 'GENERAL',
              analysis: 'N° ingreso a midas.',
              result: '2605786',
              unit: '',
              refValue: '',
            },
            {
              section: 'GENERAL',
              analysis: 'Leucocitos',
              result: 'Negativo',
              unit: ' ',
              refValue: '',
              qualitative: true,
            },
            {
              section: 'GENERAL',
              analysis: 'Cuerpos Cetónicos',
              result: 'Negativo',
              unit: '',
              refValue: '',
              qualitative: true,
            },
            {
              section: 'GENERAL',
              analysis: 'Nitritos',
              result: 'Negativo',
              unit: '',
              refValue: '',
              qualitative: true,
            },
            {
              section: 'GENERAL',
              analysis: 'Sangre',
              result: 'Negativo',
              unit: '',
              refValue: '',
              qualitative: true,
            },
            {
              section: 'GENERAL',
              analysis: 'Urobilinógeno',
              result: 'Negativo',
              unit: '',
              refValue: '',
              qualitative: true,
            },
            {
              section: 'GENERAL',
              analysis: 'Glucosa',
              result: 'Negativo',
              unit: '',
              refValue: '',
              qualitative: true,
            },
            {
              section: 'GENERAL',
              analysis: 'Rel. Proteinuria/Creatininuria',
              result: '136,2',
              unit: '',
              refValue: '< 200,0',
            },
            {
              section: 'GENERAL',
              analysis: 'RELAC. ALBUMINA/CREATINURIA',
              result: '238,9',
              unit: '',
              refValue: '< 30,0',
            },
            {
              section: 'GENERAL',
              analysis: 'Creatininuria',
              result: '92,5',
              unit: 'mg/dL',
              refValue: '70,0 - 140,0',
            },
            {
              section: 'GENERAL',
              analysis: 'Proteinuria',
              result: '126',
              unit: 'mg/L',
              refValue: '10 - 140',
            },
            {
              section: 'GENERAL',
              analysis: 'Microalbuminuria',
              result: '221',
              unit: 'mg/L',
              refValue: '< 250',
            },
          ],
        },
      ],
      [urineExam]
    );

    expect(result.comparison['ORINA FISICO-QUIMICO']).toBeUndefined();
    expect(result.comparison['N° ingreso a midas.']).toBeUndefined();
    expect(result.comparison['Recuento Leucocitos']).toBeUndefined();
    expect(result.comparison['Cuerpos Cetónicos']).toBeUndefined();
    expect(result.comparison.Nitritos).toBeUndefined();
    expect(result.comparison.Sangre).toBeUndefined();
    expect(result.comparison['Urobilinógeno']).toBeUndefined();
    expect(result.comparison.Glucosa).toBeUndefined();
    expect(result.comparison.Creatininuria).toBeUndefined();
    expect(result.comparison.Proteinuria).toBeUndefined();
    expect(result.comparison.Microalbuminuria).toBeUndefined();
    expect(result.comparison.RPC).toBeDefined();
    expect(result.comparison.RAC).toBeDefined();
  });

  it('keeps general chemistry rows out of microbiology cards even inside mixed orders', () => {
    const mixedExam: SyslabExamItem = {
      id: '43091999',
      link: 'http://example.com/43091999',
      date: '20/04/2026',
      time: '07:00:00',
      patientName: 'TEST',
      origin: 'HOSP',
      exams: ['UROCULTIVO'],
    };

    const result = buildAnalysisData(
      [
        {
          url: mixedExam.link!,
          findings: [
            {
              section: 'MICROBIOLOGIA',
              analysis: 'Cultivo',
              result: 'No hubo desarrollo',
              unit: '',
              refValue: '',
              qualitative: true,
            },
            {
              section: 'BIOQUIMICA',
              analysis: 'Proteinas Totales',
              result: '14,5',
              unit: 'g/dL',
              refValue: '6,0-8,0',
            },
            {
              section: 'BIOQUIMICA',
              analysis: 'Albumina',
              result: '1,6',
              unit: 'g/dL',
              refValue: '3,5-5,0',
            },
          ],
        },
      ],
      [mixedExam]
    );

    expect(result.microbiologyEntries).toHaveLength(1);
    expect(result.microbiologyEntries[0]?.findings).toEqual([
      { analysis: 'Cultivo', result: 'No hubo desarrollo' },
    ]);
    expect(result.comparison['Proteinas Totales']).toBeDefined();
    expect(result.comparison.Albumina).toBeDefined();
  });
});
