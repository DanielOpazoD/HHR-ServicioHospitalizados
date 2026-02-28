/**
 * Clinical Event - Tracks procedures, surgeries, cultures, etc.
 * Persists across days while patient is hospitalized
 */
export interface ClinicalEvent {
  id: string; // UUID
  name: string; // Event name (free text)
  date: string; // ISO date string
  note?: string; // Optional additional note
  createdAt: string; // ISO timestamp when created
}

/**
 * Basic FHIR Extension structure
 */
export interface FhirExtension {
  url: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueDateTime?: string;
  valueCodeableConcept?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Basic FHIR Resource structure for Core-CL compatibility
 */
export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: {
    profile?: string[];
  };
  extension?: FhirExtension[];
  [key: string]: unknown; // Use unknown instead of any for better safety
}

/**
 * Master Patient Index
 * Sidecar collection for autocomplete and historical tracking
 */
export interface MasterPatient {
  rut: string; // ID (Primary Key)
  fullName: string;
  birthDate?: string;
  commune?: string; // Comuna de procedencia
  address?: string;
  phone?: string;
  forecast?: string; // Previsión
  gender?: string;

  // Clinical Metadata
  lastAdmission?: string;
  lastDischarge?: string;
  hospitalizations?: HospitalizationEvent[];
  vitalStatus?: 'Vivo' | 'Fallecido';

  // System Metadata
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

/**
 * Hospitalization Event
 * Recorded when a patient is detected in the census or processed via discharge/transfer
 */
export interface HospitalizationEvent {
  id: string; // Composite ID or UUID
  type: 'Ingreso' | 'Egreso' | 'Traslado' | 'Fallecimiento';
  date: string;
  diagnosis: string;
  bedName?: string;
  receivingCenter?: string; // For transfers
  isEvacuation?: boolean; // For transfers
}

/**
 * Cudyr Score configuration
 */
export interface CudyrScore {
  // Dependencia (6 items)
  changeClothes: number;
  mobilization: number;
  feeding: number;
  elimination: number;
  psychosocial: number;
  surveillance: number;

  // Riesgo (8 items)
  vitalSigns: number;
  fluidBalance: number;
  oxygenTherapy: number;
  airway: number;
  proInterventions: number;
  skinCare: number;
  pharmacology: number;
  invasiveElements: number;
}

/**
 * Individual Medical Device Instance
 * Tracks the lifecycle of a single specific device (e.g. "VVP in left arm")
 */
export interface DeviceInstance {
  id: string; // UUID
  type: string; // 'VVP', 'CVC', 'CUP', 'TQT', 'GTT', 'SNG', etc.
  installationDate: string; // ISO Date (YYYY-MM-DD)
  installationTime?: string; // HH:MM
  removalDate?: string; // ISO Date (YYYY-MM-DD)
  removalTime?: string; // HH:MM
  location?: string; // Anatomical site (e.g., 'Brazo Izquierdo')
  status: 'Active' | 'Removed';
  note?: string; // Additional clinical notes
  createdAt: number; // Epoch timestamp
  updatedAt: number; // Epoch timestamp
}

/**
 * Device date tracking for infection surveillance (IAAS)
 * Tracks installation/removal dates for invasive devices
 */
export interface DeviceInfo {
  installationDate?: string; // Date device was installed
  removalDate?: string; // Date device was removed (optional)
  note?: string; // Free text note for the device
}

/**
 * Device details mapping - allows any device to have date tracking
 * Key is the device name (e.g., 'CUP', 'CVC', 'SNG', or custom device name)
 * Value is the DeviceInfo with installation/removal dates
 */
export type DeviceDetails = Record<string, DeviceInfo>;

// Extracted type for reuse
export type DeviceType =
  | 'CVC'
  | 'LA'
  | 'CUP'
  | 'VMNI'
  | 'CNAF'
  | 'TET'
  | 'VVP#1'
  | 'VVP#2'
  | 'VVP#3'
  | string;
