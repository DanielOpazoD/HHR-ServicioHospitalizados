/**
 * Shared professionals catalog domain types.
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
