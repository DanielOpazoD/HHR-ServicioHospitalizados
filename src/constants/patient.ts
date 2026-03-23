/**
 * Patient Defaults
 * Default/empty patient data structure
 */

import { PatientData } from '@/types/domain/patient';
import { Specialty, PatientStatus } from '@/types/domain/base';

export const EMPTY_PATIENT: Omit<PatientData, 'bedId'> = {
  isBlocked: false,
  blockedReason: '',
  bedMode: 'Cama',
  hasCompanionCrib: false,
  clinicalCrib: undefined,
  patientName: '',
  firstName: '',
  lastName: '',
  secondLastName: '',
  identityStatus: 'official',
  rut: '',
  documentType: 'RUT',
  age: '',
  birthDate: '',
  biologicalSex: 'Indeterminado',
  insurance: undefined,
  admissionOrigin: undefined,
  admissionOriginDetails: '',
  origin: undefined,
  isRapanui: false,
  pathology: '',
  cie10Code: undefined,
  cie10Description: undefined,
  specialty: Specialty.EMPTY,
  ginecobstetriciaType: undefined,
  status: PatientStatus.EMPTY,
  admissionDate: '',
  admissionTime: '',
  hasWristband: true,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
  location: '',
  clinicalEvents: [],
  deliveryRoute: undefined,
  deliveryDate: undefined,
  deliveryCesareanLabor: undefined,
};
