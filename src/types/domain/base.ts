export enum BedType {
  UTI = 'UTI',
  UCI = 'UCI',
  MEDIA = 'MEDIA',
}

export enum Specialty {
  MEDICINA = 'Med Interna',
  CIRUGIA = 'Cirugía',
  TRAUMATOLOGIA = 'Traumatología',
  GINECOBSTETRICIA = 'Ginecobstetricia',
  PSIQUIATRIA = 'Psiquiatría',
  PEDIATRIA = 'Pediatría',
  ODONTOLOGIA = 'Odontología',
  OTRO = 'Otro',
  EMPTY = '',
}

export enum PatientStatus {
  GRAVE = 'Grave',
  DE_CUIDADO = 'De cuidado',
  ESTABLE = 'Estable',
  EMPTY = '',
}

export type ShiftType = 'day' | 'night';
export type PatientIdentityStatus = 'provisional' | 'official';

/**
 * Professional Specialty
 * Used by the shared professionals catalog.
 */
export type ProfessionalSpecialty =
  | 'Medicina Interna'
  | 'Cirugía'
  | 'Ginecobstetricia'
  | 'Anestesia'
  | 'Kinesiología';

export interface ProfessionalCatalogItem {
  name: string;
  phone: string;
  specialty: ProfessionalSpecialty;
  period?: string;
  lastUsed?: string;
}

export interface BedDefinition {
  id: string;
  name: string;
  type: BedType;
  isCuna: boolean; // Default configuration
  isExtra?: boolean;
}

export interface Statistics {
  occupiedBeds: number; // Adult beds occupied by patients (Census)
  occupiedCribs: number; // Nested Cribs ONLY (Internal counter)
  clinicalCribsCount: number; // Main (Cuna Mode) + Nested Cribs (For Resource Display)
  companionCribs: number; // Cribs used by healthy RN (associated to mother)
  totalCribsUsed: number; // Total physical cribs (Occupied by Patient + Companion)
  totalHospitalized: number; // occupiedBeds + occupiedCribs
  blockedBeds: number;
  serviceCapacity: number; // 18 - blocked
  availableCapacity: number;
}
