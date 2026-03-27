import type {
  CesareanLabor as RootCesareanLabor,
  DeliveryRoute as RootDeliveryRoute,
  GinecobstetriciaType as RootGinecobstetriciaType,
  PatientData as RootPatientData,
} from '@/features/census/contracts/censusDomainContracts';
import type { DeviceDetails, DeviceInstance } from '@/types/domain/clinical';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';

export type PatientRowPatientContract = RootPatientData;
export type PatientData = PatientRowPatientContract;
export type DeliveryRoute = RootDeliveryRoute;
export type CesareanLabor = RootCesareanLabor;
export type GinecobstetriciaType = RootGinecobstetriciaType;
export type PatientRowPatientPatch = Partial<PatientRowPatientContract>;
export type MaybePromiseVoid = void | Promise<void>;
export type RowMenuAlign = 'top' | 'bottom';

export interface PatientDeviceCallbacks {
  onDevicesChange: (devices: string[]) => void;
  onDeviceDetailsChange: (details: DeviceDetails) => void;
  onDeviceHistoryChange: (history: DeviceInstance[]) => void;
}

export interface PatientBedConfigCallbacks {
  onToggleMode: () => MaybePromiseVoid;
  onToggleCompanion: () => MaybePromiseVoid;
  onToggleClinicalCrib: () => void;
  onUpdateClinicalCrib: (action: 'remove') => void;
}

export interface PatientActionMenuIndicators {
  hasClinicalDocument?: boolean;
  isNewAdmission?: boolean;
}

export interface PatientActionMenuCallbacks {
  onAction: (action: PatientRowAction) => void;
  onViewDemographics: () => void;
  onViewClinicalDocuments?: () => void;
  onViewExamRequest?: () => void;
  onViewImagingRequest?: () => void;
  onViewHistory?: () => void;
}

export interface PatientActionMenuAvailability {
  showDemographicsAction: boolean;
  showMenuTrigger: boolean;
  showHistoryAction: boolean;
  showUtilityActions: boolean;
  showClinicalSection: boolean;
  showBuiltInClinicalActions: boolean;
  showClinicalDocumentsAction: boolean;
  showExamRequestAction: boolean;
  showImagingRequestAction: boolean;
}

export interface PatientActionMenuBinding {
  align: RowMenuAlign;
  isBlocked: boolean;
  readOnly: boolean;
  showCmaAction: boolean;
  accessProfile?: CensusAccessProfile;
  indicators: Required<PatientActionMenuIndicators>;
  availability: PatientActionMenuAvailability;
}
