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

export interface BedDefinition {
  id: string;
  name: string;
  type: BedType;
  isCuna: boolean; // Default configuration
  isExtra?: boolean;
}
