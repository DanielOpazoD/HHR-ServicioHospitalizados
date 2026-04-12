import { describe, expect, it } from 'vitest';
import { DataFactory } from '@/tests/factories/DataFactory';
import {
  buildCudyrPrintMetrics,
  resolveHandoffCudyrPrintDisplay,
} from '@/features/handoff/components/handoffCudyrPrintSupport';

describe('handoffCudyrPrintSupport', () => {
  it('builds print metrics from the same eligible summary used by CUDYR', () => {
    const record = DataFactory.createMockDailyRecord('2026-04-12', {
      beds: {
        R1: DataFactory.createMockPatient('R1', {
          patientName: 'Elegible',
          admissionDate: '2026-04-11',
          admissionTime: '18:00',
          cudyr: DataFactory.createMockCudyr({ changeClothes: 1 }),
        }),
        R2: DataFactory.createMockPatient('R2', {
          patientName: 'Bloqueado',
          admissionDate: '2026-04-12',
          admissionTime: '23:30',
          cudyr: DataFactory.createMockCudyr({ changeClothes: 3, vitalSigns: 3 }),
        }),
      } as never,
    });

    const metrics = buildCudyrPrintMetrics(record);

    expect(metrics.occupied).toBe(1);
    expect(metrics.categorized).toBe(1);
    expect(metrics.index).toBe(100);
  });

  it('suppresses score and category display for blocked night-shift admissions', () => {
    const display = resolveHandoffCudyrPrintDisplay('2026-04-12', {
      patientName: 'Bloqueado',
      admissionDate: '2026-04-12',
      admissionTime: '23:30',
      cudyr: DataFactory.createMockCudyr({ changeClothes: 3, vitalSigns: 3 }),
    });

    expect(display.isEligible).toBe(false);
    expect(display.visibleScores).toBeUndefined();
    expect(display.categorization.finalCat).toBe('');
  });
});
