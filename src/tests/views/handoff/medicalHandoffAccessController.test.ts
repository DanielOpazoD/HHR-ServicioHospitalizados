import { describe, expect, it } from 'vitest';

import { resolveMedicalHandoffCapabilities } from '@/features/handoff/controllers/medicalHandoffAccessController';

describe('medicalHandoffAccessController', () => {
  it('restricts doctor_specialist to observations and clinical events only', () => {
    const capabilities = resolveMedicalHandoffCapabilities({
      role: 'doctor_specialist',
      readOnly: false,
      specialistAccess: false,
    });

    expect(capabilities.canCreatePrimaryObservationEntry).toBe(true);
    expect(capabilities.canEditObservationEntries).toBe(true);
    expect(capabilities.canEditClinicalEvents).toBe(true);
    expect(capabilities.canEditObservationEntrySpecialty).toBe(false);
    expect(capabilities.canAddObservationEntries).toBe(false);
    expect(capabilities.canDeleteObservationEntries).toBe(false);
    expect(capabilities.canConfirmObservationContinuity).toBe(false);
    expect(capabilities.canEditDoctorName).toBe(false);
    expect(capabilities.canShowDeliverySection).toBe(false);
    expect(capabilities.canSign).toBe(false);
    expect(capabilities.canRestoreSignatures).toBe(false);
    expect(capabilities.canSendWhatsApp).toBe(false);
    expect(capabilities.canShareSignatureLinks).toBe(false);
    expect(capabilities.canCopySpecialistLink).toBe(false);
    expect(capabilities.canOpenNightCudyr).toBe(false);
  });

  it('keeps the restricted capability set in specialist link access mode', () => {
    const capabilities = resolveMedicalHandoffCapabilities({
      role: 'doctor_specialist',
      readOnly: false,
      specialistAccess: true,
    });

    expect(capabilities.canCreatePrimaryObservationEntry).toBe(true);
    expect(capabilities.canEditObservationEntries).toBe(true);
    expect(capabilities.canEditClinicalEvents).toBe(true);
    expect(capabilities.canSign).toBe(false);
    expect(capabilities.canShowDeliverySection).toBe(false);
    expect(capabilities.canCopySpecialistLink).toBe(false);
  });
});
