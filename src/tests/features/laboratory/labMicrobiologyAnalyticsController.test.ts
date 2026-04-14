import { describe, expect, it } from 'vitest';
import {
  buildMicrobiologyEntriesForExam,
  collectMicrobiologyFinding,
  hasMicrobiologyPattern,
  resolveMicrobiologyCategoriesForExam,
} from '@/features/laboratory/controllers/labMicrobiologyAnalyticsController';
import type {
  LabMicrobiologyCategory,
  LabResultRow,
  SyslabExamItem,
} from '@/types/domain/laboratory';

describe('labMicrobiologyAnalyticsController', () => {
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

  it('detects microbiology patterns and categories from the combined exam names', () => {
    expect(hasMicrobiologyPattern('Rhinovirus')).toBe(true);
    expect(resolveMicrobiologyCategoriesForExam(combinedExam)).toEqual([
      'cultivo_corriente',
      'pcr_panel_respiratorio',
    ]);
  });

  it('routes culture and PCR findings into separate category buckets', () => {
    const findingsByCategory = new Map<
      LabMicrobiologyCategory,
      Array<{ analysis: string; result: string }>
    >();

    const findings: LabResultRow[] = [
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
    ];

    for (const finding of findings) {
      collectMicrobiologyFinding(
        finding,
        resolveMicrobiologyCategoriesForExam(combinedExam),
        findingsByCategory
      );
    }

    const entries = buildMicrobiologyEntriesForExam({
      exam: combinedExam,
      date: '06/04/2026 11:40',
      categories: resolveMicrobiologyCategoriesForExam(combinedExam),
      findingsByCategory,
    });

    const cultivo = entries.find(entry => entry.examLabel === 'Cultivo corriente / Antibiograma');
    const pcr = entries.find(entry => entry.examLabel === 'PCR panel respiratorio');

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
});
