import { ACTIONS, canDoAction } from '@/utils/permissions';
import type { UserRole } from '@/types';

export interface MedicalHandoffCapabilities {
  canEditClinicalContent: boolean;
  canEditDoctorName: boolean;
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
  const canEditClinicalContent = !readOnly;
  const canSign = !specialistAccess && !readOnly && canDoAction(role, ACTIONS.HANDOFF_MEDICAL_SIGN);
  const canRestoreSignatures = !specialistAccess && role === 'admin';
  const canSendWhatsApp =
    !specialistAccess && !readOnly && canDoAction(role, ACTIONS.HANDOFF_SEND_WHATSAPP);
  const canShareSignatureLinks = canSendWhatsApp;

  return {
    canEditClinicalContent,
    canEditDoctorName: !specialistAccess && !readOnly,
    canSign,
    canRestoreSignatures,
    canSendWhatsApp,
    canShareSignatureLinks,
    canCopySpecialistLink: !specialistAccess && !readOnly,
    canOpenNightCudyr: !specialistAccess,
  };
};
