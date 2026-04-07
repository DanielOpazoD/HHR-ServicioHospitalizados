/**
 * Transfer Management Types
 * Types for the patient transfer request workflow
 */

import { QuestionnaireResponse } from './transferDocuments';

// ============================================================================
// Enums and Constants
// ============================================================================

/**
 * Transfer request status progression
 */
export type TransferStatus =
  | 'REQUESTED'
  | 'RECEIVED'
  | 'ACCEPTED'
  | 'ACCEPTED_WITH_CAPACITY'
  | 'ACCEPTED_WAITING_CAPACITY'
  | 'REJECTED'
  | 'NO_RESPONSE'
  | 'TRANSFERRED'
  | 'CANCELLED';

/**
 * Status display configuration
 */
export interface TransferStatusDisplay {
  label: string;
  /** Short label used inside grouped dropdown entries (falls back to label) */
  shortLabel?: string;
  color: string;
  bgColor: string;
}

export const TRANSFER_STATUS_CONFIG: Record<TransferStatus, TransferStatusDisplay> = {
  REQUESTED: { label: 'Solicitado', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  RECEIVED: { label: 'Recepcionado', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  ACCEPTED: { label: 'Aceptado', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  ACCEPTED_WITH_CAPACITY: {
    label: 'Aceptado · Cupo confirmado',
    shortLabel: 'Cupo confirmado',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
  },
  ACCEPTED_WAITING_CAPACITY: {
    label: 'Aceptado · En espera cupo',
    shortLabel: 'En espera cupo',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
  },
  REJECTED: { label: 'Rechazado', color: 'text-rose-700', bgColor: 'bg-rose-100' },
  NO_RESPONSE: { label: 'Sin respuesta', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  TRANSFERRED: { label: 'Trasladado', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  CANCELLED: { label: 'Cancelado', color: 'text-rose-700', bgColor: 'bg-rose-100' },
};

// ============================================================================
// Core Types
// ============================================================================

/**
 * Snapshot of patient data at time of transfer request
 * Preserved for historical accuracy even if patient record changes
 */
export interface PatientSnapshot {
  name: string;
  rut: string;
  age: number;
  birthDate?: string; // Date of birth from census
  sex: 'M' | 'F';
  diagnosis: string;
  secondaryDiagnoses?: string[];
  admissionDate: string;
}

export interface TransferNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Record of a status change in the transfer workflow
 */
export interface StatusChange {
  from: TransferStatus | null;
  to: TransferStatus;
  timestamp: string;
  userId: string;
  notes?: string;
  cancellationReason?: string;
}

/**
 * Main transfer request entity
 */
export interface TransferRequest {
  id: string;

  // Patient reference
  patientId: string;
  bedId: string;
  patientSnapshot: PatientSnapshot;

  // Transfer details
  destinationHospital: string;
  transferReason: string;
  requestingDoctor: string;
  requiredSpecialty?: string;
  requiredBedType?: string;
  observations?: string;
  transferNotes?: TransferNote[];

  // Dynamic fields per hospital
  customFields: Record<string, string>;

  // Persistent questionnaire data
  questionnaireResponses?: QuestionnaireResponse;

  // Status tracking
  status: TransferStatus;
  statusHistory: StatusChange[];
  requestDate: string;

  // Archive tracking
  archived?: boolean;
  archivedAt?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * Form data for creating/editing a transfer request
 */
export interface TransferFormData {
  patientId: string;
  bedId: string;
  requestDate?: string;
  destinationHospital: string;
  transferReason: string;
  requestingDoctor: string;
  requiredSpecialty?: string;
  requiredBedType?: string;
  observations?: string;
  transferNotes?: TransferNote[];
  customFields?: Record<string, string>;
}

/**
 * Hospital template configuration
 */
export interface HospitalTemplate {
  id: string;
  name: string;
  requiredFields: string[];
  templateUrl?: string;
}
