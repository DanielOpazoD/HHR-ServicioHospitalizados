import type { MedicalSpecialty } from './domain/dailyRecordMedicalHandoff';

export type UserRole =
  | 'viewer'
  | 'editor'
  | 'admin'
  | 'nurse_hospital'
  | 'doctor_urgency'
  | 'doctor_specialist';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role?: UserRole;
  medicalSpecialties?: MedicalSpecialty[];
}
