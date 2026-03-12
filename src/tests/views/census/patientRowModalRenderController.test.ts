import { describe, expect, it, vi } from 'vitest';
import { buildPatientRowModalRenderModel } from '@/features/census/controllers/patientRowModalRenderController';
import { DataFactory } from '@/tests/factories/DataFactory';

describe('patientRowModalRenderController', () => {
  it('builds demographics and visibility state from modal props', () => {
    const onSaveDemographics = vi.fn();
    const onSaveCribDemographics = vi.fn();

    const result = buildPatientRowModalRenderModel({
      bedId: 'R1',
      data: DataFactory.createMockPatient('R1', {
        patientName: 'RN principal',
        rut: '',
        bedMode: 'Cuna',
      }),
      isSubRow: false,
      showDemographics: true,
      showClinicalDocuments: false,
      canOpenClinicalDocuments: false,
      showExamRequest: false,
      canOpenExamRequest: true,
      showImagingRequest: false,
      canOpenImagingRequest: true,
      showHistory: false,
      canOpenHistory: true,
      onSaveDemographics,
      onSaveCribDemographics,
    });

    expect(result.visibilityState.shouldRenderDemographics).toBe(true);
    expect(result.demographicsBinding.targetBedId).toBe('R1');
    expect(result.demographicsBinding.isRnIdentityContext).toBe(true);
    expect(result.historyPatientRut).toBe('');
    expect(result.historyPatientName).toBe('RN principal');
    expect(result.demographicsKey).toContain('demographics-R1-open');
  });
});
