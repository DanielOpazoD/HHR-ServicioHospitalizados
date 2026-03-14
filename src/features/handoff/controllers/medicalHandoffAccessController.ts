import { ACTIONS, canDoAction } from '@/utils/permissions';
import type { UserRole } from '@/types';

export interface MedicalHandoffCapabilities {
  canEditObservationEntries: boolean;
  canEditObservationEntrySpecialty: boolean;
  canAddObservationEntries: boolean;
  canDeleteObservationEntries: boolean;
  canConfirmObservationContinuity: boolean;
  canEditClinicalEvents: boolean;
  canEditDoctorName: boolean;
  canShowDeliverySection: boolean;
  canSign: boolean;
  canRestoreSignatures: boolean;
  canSendWhatsApp: boolean;
  canShareSignatureLinks: boolean;
  canCopySpecialistLink: boolean;
  canOpenNightCudyr: boolean;
}

interface ResolveMedicalHandoffCapabilitiesParams {
  role: UserRole | undefined;
  readOnly: boolean;
  specialistAccess?: boolean;
}

export const resolveMedicalHandoffCapabilities = ({
  role,
  readOnly,
  specialistAccess = false,
}: ResolveMedicalHandoffCapabilitiesParams): MedicalHandoffCapabilities => {
  const specialistRole = role === 'doctor_specialist';
  const specialistRestrictedAccess = specialistAccess || specialistRole;
  const canEditClinicalContent = !readOnly;
  const canSign =
    !specialistRestrictedAccess && !readOnly && canDoAction(role, ACTIONS.HANDOFF_MEDICAL_SIGN);
  const canRestoreSignatures = !specialistRestrictedAccess && role === 'admin';
  const canSendWhatsApp =
    !specialistRestrictedAccess && !readOnly && canDoAction(role, ACTIONS.HANDOFF_SEND_WHATSAPP);
  const canShareSignatureLinks = canSendWhatsApp;

  return {
    canEditObservationEntries: canEditClinicalContent,
    canEditObservationEntrySpecialty: !specialistRestrictedAccess && canEditClinicalContent,
    canAddObservationEntries: !specialistRestrictedAccess && canEditClinicalContent,
    canDeleteObservationEntries: !specialistRestrictedAccess && canEditClinicalContent,
    canConfirmObservationContinuity: !specialistRestrictedAccess && canEditClinicalContent,
    canEditClinicalEvents: canEditClinicalContent,
    canEditDoctorName: !specialistRestrictedAccess && !readOnly,
    canShowDeliverySection: !specialistRestrictedAccess,
    canSign,
    canRestoreSignatures,
    canSendWhatsApp,
    canShareSignatureLinks,
    canCopySpecialistLink: !specialistRestrictedAccess && !readOnly,
    canOpenNightCudyr: !specialistRestrictedAccess,
  };
};
