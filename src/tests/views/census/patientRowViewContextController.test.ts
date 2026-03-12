import { describe, expect, it, vi } from 'vitest';

import {
  buildPatientRowModalViewContext,
  resolvePatientRowViewContext,
} from '@/features/census/controllers/patientRowViewContextController';
import type { PatientRowRuntime } from '@/features/census/components/patient-row/patientRowRuntimeContracts';
import { DataFactory } from '@/tests/factories/DataFactory';

const asRuntime = (value: Partial<PatientRowRuntime>): PatientRowRuntime =>
  value as unknown as PatientRowRuntime;

describe('patientRowViewContextController', () => {
  it('resolves row capabilities and indicators from runtime state', () => {
    const runtime = asRuntime({
      rowState: {
        isBlocked: false,
        isEmpty: false,
        hasCompanion: false,
        hasClinicalCrib: false,
        isCunaMode: false,
      },
    });

    const context = resolvePatientRowViewContext({
      role: 'doctor_urgency',
      data: DataFactory.createMockPatient('R1'),
      runtime,
      indicators: {
        hasClinicalDocument: true,
        isNewAdmission: true,
      },
    });

    expect(context.capabilities.canOpenClinicalDocuments).toBe(true);
    expect(context.indicators).toEqual({
      hasClinicalDocument: true,
      isNewAdmission: true,
    });
  });

  it('builds modal view context with empty indicators and same capabilities', () => {
    const runtime = asRuntime({
      rowState: {
        isBlocked: false,
        isEmpty: false,
        hasCompanion: false,
        hasClinicalCrib: false,
        isCunaMode: false,
      },
    });

    const context = buildPatientRowModalViewContext({
      role: 'viewer_census',
      data: DataFactory.createMockPatient('R1'),
      runtime,
    });

    expect(context.capabilities.canOpenClinicalDocuments).toBe(false);
    expect(context.indicators).toEqual({
      hasClinicalDocument: false,
      isNewAdmission: false,
    });
  });
});
