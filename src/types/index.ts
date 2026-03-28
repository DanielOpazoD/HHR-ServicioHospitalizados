/**
 * @deprecated Compatibility barrel only.
 *
 * New source code must import from the owning module (`@/types/domain/*`,
 * `@/types/auth`, `@/types/reminders`, etc.). Retirement is tracked via
 * compatibility governance and enforced by quality checks.
 */

// Core domain types (enums, interfaces)
export {
  // Enums
  BedType,
  Specialty,
  PatientStatus,

  // Interfaces
  type BedDefinition,
  type CudyrScore,
  type ClinicalEvent,
  type PatientData,
  type MasterPatient,
  type HospitalizationEvent,
  type DeviceInfo,
  type DeviceDetails,
  type DeviceInstance,
  type IeehData,
  type MedicalHandoffAudit,
  type MedicalHandoffAuditActor,
  type MedicalHandoffEntry,
  type DischargeData,
  type TransferData,
  type CMAData,
  type DailyRecord,
  type MedicalHandoffActor,
  type MedicalHandoffBySpecialty,
  type MedicalHandoffDailyContinuityEntry,
  type MedicalSpecialty,
  type MedicalSpecialtyHandoffNote,
  type DischargeType,
  type ShiftType,
  type PatientIdentityStatus,
  type FhirResource,
  type DailyRecordPatch,
  type DailyRecordPatchPath,
} from './core';
export type { Statistics } from './domain/statistics';
export type { ProfessionalSpecialty, ProfessionalCatalogItem } from './domain/professionals';

// Value types and utilities
export {
  // Field value types for type-safe updates
  type PatientFieldValue,
  type PatientStringField,
  type PatientBooleanField,
  type PatientArrayField,
  type PatientEnumField,
  type PatientObjectField,

  // Error handling
  type CaughtError,
  getErrorMessage,

  // Component types
  type IconComponent,

  // Utility functions
  randomItem,
  escapeCsvValue,
} from './valueTypes';

// Audit logging types
export { type AuditLogEntry, type AuditAction, maskRut } from './audit';

// WhatsApp integration types
export {
  type WeeklyShift,
  type ShiftStaffMember,
  type HandoffWhatsAppStatus,
  type HandoffAutoSend,
  type WhatsAppConfig,
  type WhatsAppLog,
} from './whatsapp';

// Auth types
export {
  type AuthSessionError,
  type AuthSessionState,
  type AuthSessionSeverity,
  type AuthSessionStatus,
  type AuthUser,
  type UserRole,
} from './auth';

// Reminders
export {
  type Reminder,
  type ReminderReadReceipt,
  type ReminderShift,
  type ReminderType,
  type ReminderVisibilityContext,
} from './reminders';
