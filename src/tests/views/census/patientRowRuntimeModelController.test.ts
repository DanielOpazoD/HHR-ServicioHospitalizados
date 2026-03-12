import { describe, expect, it, vi } from 'vitest';
import {
  buildPatientRowEditingRuntimeParams,
  buildPatientRowInteractionRuntimeParams,
} from '@/features/census/controllers/patientRowRuntimeModelController';
import { DataFactory } from '@/tests/factories/DataFactory';

describe('patientRowRuntimeModelController', () => {
  it('builds editing runtime params from row dependencies', () => {
    const updatePatient = vi.fn();
    const updatePatientMultiple = vi.fn();
    const updateClinicalCrib = vi.fn();
    const updateClinicalCribMultiple = vi.fn();

    const result = buildPatientRowEditingRuntimeParams({
      bed: { id: 'R1' },
      data: { documentType: 'RUT' },
      dependencies: {
        updatePatient,
        updatePatientMultiple,
        updateClinicalCrib,
        updateClinicalCribMultiple,
      },
    });

    expect(result).toEqual({
      bedId: 'R1',
      documentType: 'RUT',
      updatePatient,
      updatePatientMultiple,
      updateClinicalCrib,
      updateClinicalCribMultiple,
    });
  });

  it('builds interaction runtime params from row state and callbacks', () => {
    const patient = DataFactory.createMockPatient('R1');
    const onAction = vi.fn();
    const updatePatient = vi.fn();
    const updateClinicalCrib = vi.fn();
    const toggleBedType = vi.fn();
    const confirm = vi.fn();
    const alert = vi.fn();

    const result = buildPatientRowInteractionRuntimeParams({
      bed: { id: 'R1' },
      data: patient,
      onAction,
      rowState: {
        isCunaMode: false,
        hasCompanion: false,
        hasClinicalCrib: false,
      },
      dependencies: {
        updatePatient,
        updateClinicalCrib,
        toggleBedType,
        confirm,
        alert,
      },
    });

    expect(result.bedId).toBe('R1');
    expect(result.data).toBe(patient);
    expect(result.onAction).toBe(onAction);
    expect(result.updatePatient).toBe(updatePatient);
    expect(result.updateClinicalCrib).toBe(updateClinicalCrib);
    expect(result.toggleBedType).toBe(toggleBedType);
    expect(result.confirm).toBe(confirm);
    expect(result.alert).toBe(alert);
  });
});
