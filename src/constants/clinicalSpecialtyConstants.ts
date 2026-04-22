import { Specialty, PatientStatus } from '@/types/domain/patientClassification';

export const SPECIALTY_OPTIONS = Object.values(Specialty).filter(s => s !== '');
export const STATUS_OPTIONS = Object.values(PatientStatus).filter(s => s !== '');

export const SPECIALTY_ABBREVIATIONS: Record<string, string> = {
  [Specialty.MEDICINA]: 'MI',
  [Specialty.CIRUGIA]: 'Cir',
  [Specialty.TRAUMATOLOGIA]: 'TMT',
  [Specialty.GINECOBSTETRICIA]: 'Gyn',
  [Specialty.PSIQUIATRIA]: 'PSQ',
  [Specialty.PEDIATRIA]: 'Ped',
  [Specialty.ODONTOLOGIA]: 'Odo',
  [Specialty.OTRO]: 'Otro',
};

export const ADMISSION_ORIGIN_OPTIONS: string[] = ['CAE', 'APS', 'Urgencias', 'Pabellón', 'Otro'];
export type AdmissionOrigin = 'CAE' | 'APS' | 'Urgencias' | 'Pabellón' | 'Otro';
