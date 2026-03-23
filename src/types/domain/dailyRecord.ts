import type { Specialty, PatientStatus, BedType } from './base';
import type { PatientData } from './patient';
import type {
  CudyrScore,
  ClinicalEvent,
  DeviceDetails,
  DeviceInstance,
  FhirResource,
} from './clinical';
import type { DischargeData, TransferData, CMAData } from './movements';

export type MedicalSpecialty =
  | 'cirugia'
  | 'traumatologia'
  | 'ginecobstetricia'
  | 'pediatria'
  | 'psiquiatria'
  | 'medicinaInterna';

export interface MedicalHandoffActor {
  uid: string;
  displayName: string;
  email: string;
  specialty?: MedicalSpecialty;
  role?: string;
}

export interface MedicalHandoffDailyContinuityEntry {
  status: 'updated_by_specialist' | 'confirmed_no_changes';
  confirmedBy?: MedicalHandoffActor;
  confirmedAt?: string;
  comment?: string;
}

export interface MedicalSpecialtyHandoffNote {
  note: string;
  createdAt: string;
  updatedAt: string;
  author: MedicalHandoffActor;
  lastEditor?: MedicalHandoffActor;
  version: number;
  dailyContinuity?: Record<string, MedicalHandoffDailyContinuityEntry>;
}

export type MedicalHandoffBySpecialty = Partial<
  Record<MedicalSpecialty, MedicalSpecialtyHandoffNote>
>;

export interface DailyRecord {
  date: string;
  beds: Record<string, PatientData>;
  bedTypeOverrides?: Record<string, BedType>;
  discharges: DischargeData[];
  transfers: TransferData[];
  cma: CMAData[]; // Cirugía Mayor Ambulatoria
  lastUpdated: string;
  /** Unix timestamp (ms) for the start of the day, used for security rule validation */
  dateTimestamp?: number;
  /** Version of the data structure, used to prevent corruption from old clients */
  schemaVersion?: number;
  /** @deprecated Use nursesDayShift / nursesNightShift instead. Maintained only for legacy compatibility on read. */
  nurses?: string[];
  /** @deprecated Use nursesDayShift[0]. Maintained only for legacy compatibility on read. */
  nurseName?: string;
  nursesDayShift?: string[]; // Turno Largo nurses
  nursesNightShift?: string[]; // Turno Noche nurses
  tensDayShift?: string[]; // Turno Largo TENS (max 3)
  tensNightShift?: string[]; // Turno Noche TENS (max 3)
  activeExtraBeds: string[];

  // ===== Handoff Checklist - Day Shift (Turno Largo) =====
  handoffDayChecklist?: {
    escalaBraden?: boolean;
    escalaRiesgoCaidas?: boolean;
    escalaRiesgoLPP?: boolean;
  };

  // ===== Handoff Checklist - Night Shift (Turno Noche) =====
  handoffNightChecklist?: {
    estadistica?: boolean;
    categorizacionCudyr?: boolean;
    encuestaUTI?: boolean;
    encuestaMedias?: boolean;
    conteoMedicamento?: boolean;
    conteoNoControlados?: boolean;
    conteoNoControladosProximaFecha?: string;
  };

  // ===== Handoff Novedades (Free text section) =====
  handoffNovedadesDayShift?: string;
  handoffNovedadesNightShift?: string;

  // ===== Nurse Handoff Identification =====
  handoffNightReceives?: string[]; // Nurses who receive night shift (Next day's night or unique)

  // ===== Medical Handoff Novedades =====
  medicalHandoffNovedades?: string; // Free text novedades for medical handoff
  medicalHandoffBySpecialty?: MedicalHandoffBySpecialty;

  // ===== Medical Handoff Signature =====
  medicalHandoffDoctor?: string; // Doctor delivering the shift
  medicalHandoffSentAt?: string; // Timestamp when the share link was clicked
  medicalHandoffSentAtByScope?: Partial<Record<'all' | 'upc' | 'no-upc', string>>;
  medicalSignatureLinkTokenByScope?: Partial<Record<'all' | 'upc' | 'no-upc', string>>;
  medicalSignature?: {
    doctorName: string;
    signedAt: string; // ISO timestamp
    userAgent?: string; // Optional device info
  };
  medicalSignatureByScope?: Partial<
    Record<
      'all' | 'upc' | 'no-upc',
      {
        doctorName: string;
        signedAt: string;
        userAgent?: string;
      }
    >
  >;

  // ===== CUDYR Lock (Prevents new patients from being added to CUDYR after cutoff) =====
  /** Whether CUDYR editing is locked for this day */
  cudyrLocked?: boolean;
  /** ISO timestamp when CUDYR was locked */
  cudyrLockedAt?: string;
  /** User ID who locked the CUDYR */
  cudyrLockedBy?: string;
  /** ISO timestamp when the last CUDYR score or closure was saved */
  cudyrUpdatedAt?: string;
}

// ============================================================================
// Patch Types for Type-Safe Firestore Updates
// ============================================================================

/**
 * Represents a dot-notation path for nested object updates.
 * Used by Firestore's updateDoc for partial updates.
 */

// Type-safe paths for PatientData fields
type PatientFieldPath = `beds.${string}.${keyof PatientData}`;
type PatientCudyrPath = `beds.${string}.cudyr.${keyof CudyrScore}`;
type PatientClinicalCribPath = `beds.${string}.clinicalCrib.${keyof PatientData}`;
type PatientDeviceDetailsPath = `beds.${string}.deviceDetails.${string}`;

// Type-safe paths for Top-level DailyRecord fields
type TopLevelPath = keyof Pick<
  DailyRecord,
  | 'date'
  | 'lastUpdated'
  | 'nurses'
  | 'nurseName'
  | 'nursesDayShift'
  | 'nursesNightShift'
  | 'tensDayShift'
  | 'tensNightShift'
  | 'activeExtraBeds'
  | 'discharges'
  | 'transfers'
  | 'cma'
  | 'beds'
  | 'handoffNovedadesDayShift'
  | 'handoffNovedadesNightShift'
  | 'medicalHandoffNovedades'
  | 'medicalHandoffBySpecialty'
  | 'medicalHandoffDoctor'
  | 'medicalHandoffSentAt'
  | 'medicalHandoffSentAtByScope'
  | 'medicalSignatureLinkTokenByScope'
  | 'medicalSignature'
  | 'medicalSignatureByScope'
  | 'cudyrLocked'
  | 'cudyrLockedAt'
  | 'cudyrLockedBy'
  | 'cudyrUpdatedAt'
>;

// Type-safe paths for Handoff Checklist
type HandoffDayChecklistPath = `handoffDayChecklist.${string}`;
type HandoffNightChecklistPath = `handoffNightChecklist.${string}`;
type HandoffStaffPath =
  | `handoffDayDelivers`
  | `handoffDayReceives`
  | `handoffNightDelivers`
  | `handoffNightReceives`;
type MedicalSignaturePath =
  | `medicalSignature`
  | `medicalSignature.${string}`
  | `medicalSignatureByScope`
  | `medicalSignatureByScope.${string}`
  | `medicalSignatureByScope.${string}.${string}`
  | `medicalHandoffSentAtByScope`
  | `medicalHandoffSentAtByScope.${string}`
  | `medicalSignatureLinkTokenByScope`
  | `medicalSignatureLinkTokenByScope.${string}`;

/**
 * Union of all valid patch paths.
 * This provides compile-time checking for patch keys.
 */
export type DailyRecordPatchPath =
  | TopLevelPath
  | PatientFieldPath
  | PatientCudyrPath
  | PatientClinicalCribPath
  | PatientDeviceDetailsPath
  | HandoffDayChecklistPath
  | HandoffNightChecklistPath
  | HandoffStaffPath
  | MedicalSignaturePath;

/**
 * Type-safe patch object for DailyRecord updates.
 * Keys are dot-notation paths, values are the corresponding field types.
 * The string index signature allows dynamic paths while known paths get type hints.
 */
export type DailyRecordPatch = {
  [K in DailyRecordPatchPath]?: K extends TopLevelPath
    ? DailyRecord[K]
    : K extends PatientCudyrPath
      ? number
      : K extends HandoffDayChecklistPath | HandoffNightChecklistPath
        ? boolean | string
        : K extends HandoffStaffPath
          ? string[]
          : // For dynamic paths, allow common value types
              | string
              | number
              | boolean
              | string[]
              | PatientData
              | CudyrScore
              | DeviceDetails
              | PatientStatus
              | Specialty
              | ClinicalEvent[]
              | DeviceInstance[]
              | FhirResource
              | Record<string, unknown>
              | null
              | undefined;
} & {
  // Fallback: Allow any string key with unknown value for truly dynamic paths
  [key: string]: unknown;
};
