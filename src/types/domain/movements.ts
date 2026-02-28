import type { PatientData } from './patient';

export type DischargeType = 'Domicilio (Habitual)' | 'Voluntaria' | 'Fuga' | 'Otra';

export interface IeehData {
  diagnosticoPrincipal?: string;
  cie10Code?: string;
  condicionEgreso?: string;
  intervencionQuirurgica?: string;
  intervencionQuirurgDescrip?: string;
  procedimiento?: string;
  procedimientoDescrip?: string;
  tratanteApellido1?: string;
  tratanteApellido2?: string;
  tratanteNombre?: string;
  tratanteRut?: string;
}

export interface DischargeData {
  id: string;
  movementDate?: string; // YYYY-MM-DD
  bedName: string;
  bedId: string; // Needed for undo
  bedType: string;
  patientName: string;
  rut: string;
  diagnosis: string;
  time: string;
  status: 'Vivo' | 'Fallecido';
  dischargeType?: DischargeType; // Sub-classification for 'Vivo'
  dischargeTypeOther?: string; // Description if 'Otra'
  age?: string;
  insurance?: string;
  origin?: string;
  isRapanui?: boolean;
  originalData?: PatientData; // Snapshot for Undo
  isNested?: boolean; // Identifies if it was a clinical crib
  ieehData?: IeehData; // Persisted IEEH PDF generation data
}

export interface TransferData {
  id: string;
  movementDate?: string; // YYYY-MM-DD
  bedName: string;
  bedId: string; // Needed for undo
  bedType: string;
  patientName: string;
  rut: string;
  diagnosis: string;
  time: string;
  evacuationMethod: string;
  evacuationMethodOther?: string;
  receivingCenter: string;
  receivingCenterOther?: string;
  transferEscort?: string;
  age?: string;
  insurance?: string;
  origin?: string;
  isRapanui?: boolean;
  originalData?: PatientData; // Snapshot for Undo
  isNested?: boolean; // Identifies if it was a clinical crib
}

export interface CMAData {
  id: string;
  bedName: string; // Generic location or identifier
  patientName: string;
  rut: string;
  age: string;
  birthDate?: string;
  biologicalSex?: 'Masculino' | 'Femenino' | 'Indeterminado';
  insurance?: 'Fonasa' | 'Isapre' | 'Particular';
  admissionOrigin?: 'CAE' | 'APS' | 'Urgencias' | 'Pabellón' | 'Otro';
  admissionOriginDetails?: string;
  origin?: 'Residente' | 'Turista Nacional' | 'Turista Extranjero';
  isRapanui?: boolean;
  diagnosis: string;
  cie10Code?: string;
  cie10Description?: string;
  specialty: string;
  interventionType: 'Cirugía Mayor Ambulatoria' | 'Procedimiento Médico Ambulatorio'; // New field
  dischargeTime?: string; // Time when patient was discharged (HH:MM format)
  enteredBy?: string; // Optional: user who added the record
  timestamp?: string; // Optional: creation time
  originalBedId?: string; // For undo: original bed ID
  originalData?: PatientData; // For undo: snapshot of original patient data
}
