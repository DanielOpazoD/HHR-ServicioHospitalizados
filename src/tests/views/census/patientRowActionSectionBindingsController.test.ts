import { describe, expect, it, vi } from 'vitest';

import { buildPatientActionSectionBinding } from '@/features/census/controllers/patientRowActionSectionBindingsController';

describe('patientRowActionSectionBindingsController', () => {
  it('maps row action availability into action cell callbacks', () => {
    const onOpenClinicalDocuments = vi.fn();
    const onOpenExamRequest = vi.fn();

    const binding = buildPatientActionSectionBinding({
      isBlocked: false,
      readOnly: false,
      actionMenuAlign: 'top',
      indicators: {
        hasClinicalDocument: true,
        isNewAdmission: false,
      },
      mainRowViewState: {
        canToggleBedType: true,
        rowClassName: 'row',
        rowActionsAvailability: {
          canOpenClinicalDocuments: true,
          canOpenExamRequest: false,
          canOpenImagingRequest: false,
          canOpenHistory: true,
          canShowClinicalDocumentIndicator: true,
        },
        showBlockedContent: false,
      },
      onAction: vi.fn(),
      onOpenDemographics: vi.fn(),
      onOpenClinicalDocuments,
      onOpenExamRequest,
      onOpenImagingRequest: vi.fn(),
      onOpenHistory: vi.fn(),
    });

    expect(binding.onViewClinicalDocuments).toBe(onOpenClinicalDocuments);
    expect(binding.onViewExamRequest).toBeUndefined();
    expect(binding.hasClinicalDocument).toBe(true);
  });
});
