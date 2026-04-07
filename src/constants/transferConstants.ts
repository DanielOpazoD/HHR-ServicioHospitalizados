/**
 * Transfer Management Constants
 * Configuration for the patient transfer workflow
 */

import { TransferStatus } from '@/types/transfers';

// ============================================================================
// Status Flow
// ============================================================================

/**
 * Allowed status transitions
 */
export const STATUS_TRANSITIONS: Record<TransferStatus, TransferStatus | null> = {
  REQUESTED: 'RECEIVED',
  RECEIVED: 'ACCEPTED_WAITING_CAPACITY',
  ACCEPTED: 'TRANSFERRED',
  ACCEPTED_WITH_CAPACITY: 'TRANSFERRED',
  ACCEPTED_WAITING_CAPACITY: 'TRANSFERRED',
  REJECTED: null,
  NO_RESPONSE: null,
  TRANSFERRED: null,
  CANCELLED: null,
};

/**
 * Get next available status
 */
export const getNextStatus = (current: TransferStatus): TransferStatus | null => {
  return STATUS_TRANSITIONS[current];
};

// ============================================================================
// Hospital Destinations
// ============================================================================

/**
 * Default destination hospitals.
 * Runtime configuration can override this catalog via settings.
 */
export const DESTINATION_HOSPITALS = [
  { id: 'salvador', name: 'Hospital Del Salvador', city: 'Santiago' },
  { id: 'calvo_mackenna', name: 'Hospital de Niños Dr. Luis Calvo Mackenna', city: 'Santiago' },
  { id: 'luis_tisne', name: 'Hospital Dr. Luis Tisne', city: 'Santiago' },
  { id: 'hosmet', name: 'Hospital Metropolitano (HOSMET)', city: 'Santiago' },
  {
    id: 'int',
    name: 'Instituto Nacional de Enfermedades Respiratorias y Cirugia Torácica (INT)',
    city: 'Santiago',
  },
  {
    id: 'inger',
    name: 'Instituto Nacional Geriátrico Presidente Eduardo Frei Montalva (INGER)',
    city: 'Santiago',
  },
  { id: 'inca', name: 'Instituto de Neurocirugía Dr. Alfonso Asenjo (INCA)', city: 'Santiago' },
  { id: 'horwitz', name: 'Instituto Psiquiátrico Dr. José Horwitz Barak', city: 'Santiago' },
  { id: 'otro', name: 'Otro', city: '' },
] as const;

export type DestinationHospitalOption = (typeof DESTINATION_HOSPITALS)[number];

// ============================================================================
// Medical Specialties
// ============================================================================

/**
 * Common specialties for transfer requests
 */
export const MEDICAL_SPECIALTIES = [
  'Cirugia',
  'Ginecobstetricia',
  'Pediatría',
  'Psiquiatría',
  'Medicina interna',
  'Urología',
  'Hematología',
  'Neurocirugía',
  'Traumatología',
  'Hemodinamia',
  'Otra',
] as const;

export const TRANSFER_BED_REQUIREMENTS = [
  'Cama básica',
  'Cama media',
  'Cama UTI',
  'Cama UCI',
  'Otra',
] as const;

// ============================================================================
// Transfer Reasons
// ============================================================================

/**
 * Common reasons for patient transfer
 */
export const TRANSFER_REASONS = [
  'Complejidad clínica requiere nivel superior',
  'Necesidad de especialista no disponible',
  'Requiere procedimiento quirúrgico especializado',
  'Requiere UCI/UPC',
  'Estudio diagnóstico avanzado',
  'Cercanía a domicilio familiar',
  'Otro',
] as const;

// ============================================================================
// Days Calculation
// ============================================================================

/**
 * Calculate days elapsed since request date
 */
export const calculateDaysElapsed = (requestDate: string): number => {
  const start = new Date(requestDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
