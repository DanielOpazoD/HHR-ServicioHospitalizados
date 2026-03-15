import { ACTIONS, canDoAction } from '@/utils/permissions';
import type { UserRole } from '@/types';
import {
  canEditSpecialistTodayBoundRecord,
  hasSpecialistRestrictedMedicalAccess,
} from '@/shared/access/specialistAccessPolicy';

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
}

export const resolveMedicalHandoffCapabilities = ({
  role,
  readOnly,
  recordDate,
  todayISO,
}: ResolveMedicalHandoffCapabilitiesParams): MedicalHandoffCapabilities => {
  const specialistRestrictedAccess = hasSpecialistRestrictedMedicalAccess(role);
  const canEditClinicalContent = canEditSpecialistTodayBoundRecord({
    role,
    readOnly,
    recordDate,
    todayISO,
  });
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
