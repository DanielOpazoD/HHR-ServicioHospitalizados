import { ACTIONS, canDoAction } from '@/utils/permissions';
import { getTodayISO } from '@/utils/dateUtils';
import type { UserRole } from '@/types';

export interface MedicalHandoffCapabilities {
  canCreatePrimaryObservationEntry: boolean;
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
  recordDate?: string;
  todayISO?: string;
  specialistAccess?: boolean;
}

export const resolveMedicalHandoffCapabilities = ({
  role,
  readOnly,
  recordDate,
  todayISO = getTodayISO(),
  specialistAccess = false,
}: ResolveMedicalHandoffCapabilitiesParams): MedicalHandoffCapabilities => {
  const specialistRole = role === 'doctor_specialist';
  const specialistRestrictedAccess = specialistAccess || specialistRole;
  const specialistCanEditRecord = !specialistRestrictedAccess || recordDate === todayISO;
  const canEditClinicalContent = !readOnly && specialistCanEditRecord;
  const canSign =
    !specialistRestrictedAccess && !readOnly && canDoAction(role, ACTIONS.HANDOFF_MEDICAL_SIGN);
  const canRestoreSignatures = !specialistRestrictedAccess && role === 'admin';
  const canSendWhatsApp =
    !specialistRestrictedAccess && !readOnly && canDoAction(role, ACTIONS.HANDOFF_SEND_WHATSAPP);
  const canShareSignatureLinks = canSendWhatsApp;

  return {
    canCreatePrimaryObservationEntry: canEditClinicalContent,
    canEditObservationEntries: canEditClinicalContent,
    canEditObservationEntrySpecialty: canEditClinicalContent,
    canAddObservationEntries: canEditClinicalContent,
    canDeleteObservationEntries: canEditClinicalContent,
    canConfirmObservationContinuity: canEditClinicalContent,
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
