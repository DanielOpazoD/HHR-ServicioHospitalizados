import type { Specialty, PatientStatus, PatientIdentityStatus } from './base';
import type {
  CudyrScore,
  ClinicalEvent,
  DeviceInstance,
  DeviceDetails,
  FhirResource,
} from './clinical';

export interface PatientData {
  bedId: string;
  isBlocked: boolean;
  blockedReason?: string;
  bedName?: string;

  // Dynamic Furniture Configuration
  bedMode: 'Cama' | 'Cuna'; // Defines if the physical spot is set up as a Bed or a Crib (Census relevant)
  hasCompanionCrib: boolean; // Defines if there is an EXTRA crib for a healthy RN (Resource relevant)

  // Nested Patient Data for Clinical Crib (Sick Newborn sharing room with Mother)
  clinicalCrib?: PatientData;

  patientName: string;
  firstName?: string;
  lastName?: string;
  secondLastName?: string;
  identityStatus?: PatientIdentityStatus;
  rut: string;
  documentType?: 'RUT' | 'Pasaporte'; // Switcher
  age: string;
  birthDate?: string;
  biologicalSex?: 'Masculino' | 'Femenino' | 'Indeterminado';
  insurance?: 'Fonasa' | 'Isapre' | 'Particular';

  // Demographics Update
  admissionOrigin?: 'CAE' | 'APS' | 'Urgencias' | 'Pabellón' | 'Otro';
  admissionOriginDetails?: string; // For 'Otro'
  origin?: 'Residente' | 'Turista Nacional' | 'Turista Extranjero'; // Now labeled "Condición de permanencia"

  isRapanui?: boolean;
  pathology: string;
  snomedCode?: string; // Standardized SNOMED CT code
  cie10Code?: string; // Standardized CIE-10 code
  cie10Description?: string; // Official CIE-10 description recorded at selection
  diagnosisComments?: string; // New field for sub-diagnosis details (e.g. surgical dates)
  specialty: Specialty;
  /** Optional secondary specialty for co-managed patients. Not used for statistics. */
  secondarySpecialty?: Specialty | string;
  status: PatientStatus;
  admissionDate: string;
  admissionTime?: string;
  hasWristband: boolean;
  devices: string[];
  deviceDetails?: DeviceDetails; // Dates/notas for tracked devices (CUP, CVC, VMI, VVP)
  surgicalComplication: boolean;
  isUPC: boolean;
  location?: string;

  // CUDYR Data
  cudyr?: CudyrScore;

  // Handoff / Nursing Evolution (Shift-based)
  handoffNote?: string; // Legacy/fallback
  handoffNoteDayShift?: string; // Turno Largo (8:00-20:00)
  handoffNoteNightShift?: string; // Turno Noche (20:00-08:00)

  // Medical Handoff
  medicalHandoffNote?: string;

  // Clinical Events (procedures, surgeries, cultures, etc.)
  clinicalEvents?: ClinicalEvent[];

  /**
   * Detailed history of individual device instances.
   * Allows tracking multiple same-type devices (e.g., 2+ VVPs) with separate timelines.
   */
  deviceInstanceHistory?: DeviceInstance[];

  // Obstetric delivery tracking (Ginecobstetricia only)
  deliveryRoute?: 'Vaginal' | 'Cesárea';
  deliveryDate?: string; // ISO date string

  // HL7 FHIR Core-CL Resource (Optional for dual-mode sync)
  fhir_resource?: FhirResource;
}
