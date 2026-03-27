import type {
  MedicalHandoffAuditActor as RootMedicalHandoffAuditActor,
  MedicalHandoffAudit as RootMedicalHandoffAudit,
  MedicalHandoffEntry as RootMedicalHandoffEntry,
  PatientData as RootPatientData,
} from '@/domain/handoff/patientContracts';
import type { Specialty } from '@/types/domain/base';

export type MedicalHandoffAuditActor = RootMedicalHandoffAuditActor;
export type MedicalHandoffEntry = RootMedicalHandoffEntry;
export type MedicalHandoffAudit = RootMedicalHandoffAudit;

export interface MedicalPatientHandoffContract {
  bedId: string;
  isBlocked: boolean;
  bedMode: RootPatientData['bedMode'];
  hasCompanionCrib: boolean;
  specialty?: Specialty | string;
  secondarySpecialty?: Specialty | string;
  medicalHandoffEntries?: MedicalHandoffEntry[];
  medicalHandoffNote?: string;
  medicalHandoffAudit?: MedicalHandoffAudit;
}

export type MedicalPatientMutationFields = Pick<
  MedicalPatientHandoffContract,
  'medicalHandoffEntries' | 'medicalHandoffNote' | 'medicalHandoffAudit'
>;

export type PatientData = RootPatientData;
