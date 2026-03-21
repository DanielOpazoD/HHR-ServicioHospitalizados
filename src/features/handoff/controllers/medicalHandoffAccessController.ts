import type { UserRole } from '@/types/auth';
import { hasSpecialistRestrictedMedicalAccess } from '@/shared/access/specialistAccessPolicy';
import {
  canEditMedicalHandoffForDate,
  canSendMedicalHandoffWhatsApp,
  canSignMedicalHandoff,
} from '@/shared/access/operationalAccessPolicy';

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
  const canEditClinicalContent = canEditMedicalHandoffForDate({
    role,
    readOnly,
    recordDate,
    todayISO,
  });
  const canSign = canSignMedicalHandoff({
    role,
    readOnly,
    specialistRestrictedAccess,
  });
  const canRestoreSignatures = !specialistRestrictedAccess && role === 'admin';
  const canSendWhatsApp = canSendMedicalHandoffWhatsApp({
    role,
    readOnly,
    specialistRestrictedAccess,
  });
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
