import { describe, expect, it } from 'vitest';
import { buildClinicalReleaseValidationReport } from '../../../scripts/clinicalReleaseValidationSupport.mjs';

describe('clinical release validation contract', () => {
  it('maps every manual clinical scenario to release matrix ownership and three closure gates', () => {
    const report = buildClinicalReleaseValidationReport(process.cwd());

    expect(report.overall).toBe('ok');
    expect(report.counts.scenarioCount).toBeGreaterThanOrEqual(5);
    expect(report.counts.highRiskScenarioCount).toBeGreaterThanOrEqual(2);

    for (const scenario of report.scenarios) {
      expect(
        scenario.matrixAreas.length,
        `${scenario.id} must map to matrix ownership`
      ).toBeGreaterThan(0);
      expect(
        scenario.automatedRegression.length,
        `${scenario.id} must name regression evidence`
      ).toBeGreaterThan(0);
      expect(
        scenario.manualValidation.length,
        `${scenario.id} must name manual validation`
      ).toBeGreaterThan(0);
      expect(scenario.closureGates).toEqual([
        'codigo_corregido',
        'regresion_automatizada',
        'flujo_clinico_validado',
      ]);
    }
  });
});
