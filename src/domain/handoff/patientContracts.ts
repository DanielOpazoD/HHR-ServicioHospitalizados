import type { ClinicalEvent as RootClinicalEvent } from '@/types/domain/clinicalEvents';
import type { DeviceDetails } from '@/types/domain/devices';
import type {
  MedicalHandoffAudit as RootMedicalHandoffAudit,
  MedicalHandoffAuditActor as RootMedicalHandoffAuditActor,
  MedicalHandoffEntry as RootMedicalHandoffEntry,
  PatientData as RootPatientData,
} from '@/types/domain/patient';
import type { PatientStatus, Specialty } from '@/types/domain/patientClassification';

export type MedicalHandoffAuditActor = RootMedicalHandoffAuditActor;
export type MedicalHandoffAudit = RootMedicalHandoffAudit;
export type MedicalHandoffEntry = RootMedicalHandoffEntry;
export type ClinicalEvent = RootClinicalEvent;

export interface HandoffPatientContract {
  bedId: string;
  isBlocked: boolean;
  blockedReason?: string;
  bedMode: RootPatientData['bedMode'];
  hasCompanionCrib: boolean;
  clinicalCrib?: HandoffPatientContract;
  patientName: string;
  rut: string;
  age: string;
  birthDate?: string;
  pathology: string;
  specialty: Specialty | string;
  secondarySpecialty?: Specialty | string;
  status: PatientStatus;
  admissionDate: string;
  admissionTime?: string;
  hasWristband: boolean;
  devices: string[];
  deviceDetails?: DeviceDetails;
  surgicalComplication: boolean;
  isUPC: boolean;
  handoffNote?: string;
  handoffNoteDayShift?: string;
  handoffNoteNightShift?: string;
  medicalHandoffNote?: string;
  medicalHandoffAudit?: MedicalHandoffAudit;
  medicalHandoffEntries?: MedicalHandoffEntry[];
  clinicalEvents?: ClinicalEvent[];
}

export type PatientData = RootPatientData;
