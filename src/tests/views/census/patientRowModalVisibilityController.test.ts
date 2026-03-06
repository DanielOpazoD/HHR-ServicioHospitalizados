import { describe, expect, it } from 'vitest';

import { resolvePatientRowModalVisibilityState } from '@/features/census/controllers/patientRowModalVisibilityController';

describe('patientRowModalVisibilityController', () => {
  it('renders clinical documents modal only when requested and authorized', () => {
    expect(
      resolvePatientRowModalVisibilityState({
        showClinicalDocuments: true,
        canOpenClinicalDocuments: true,
      })
    ).toEqual({
      shouldRenderClinicalDocuments: true,
    });

    expect(
      resolvePatientRowModalVisibilityState({
        showClinicalDocuments: true,
        canOpenClinicalDocuments: false,
      })
    ).toEqual({
      shouldRenderClinicalDocuments: false,
    });

    expect(
      resolvePatientRowModalVisibilityState({
        showClinicalDocuments: false,
        canOpenClinicalDocuments: true,
      })
    ).toEqual({
      shouldRenderClinicalDocuments: false,
    });
  });
});
