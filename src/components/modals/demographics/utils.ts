import {
  DemographicSubset,
  LocalDemographicsState,
  DocumentType,
  Insurance,
  AdmissionOrigin,
  Origin,
  BiologicalSex,
} from './types';
import { PatientIdentityStatus } from '@/types';

export const normalizeNamePart = (value: string): string => value.trim().replace(/\s+/g, ' ');

export const composeFullName = (
  firstName: string,
  lastName: string,
  secondLastName: string
): string => [firstName, lastName, secondLastName].map(normalizeNamePart).filter(Boolean).join(' ');

export const splitFromLegacyName = (
  patientName: string
): { firstName: string; lastName: string; secondLastName: string } => {
  const normalized = normalizeNamePart(patientName);
  if (!normalized) {
    return { firstName: '', lastName: '', secondLastName: '' };
  }

  const parts = normalized.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '', secondLastName: '' };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1], secondLastName: '' };
  }
  return {
    firstName: parts.slice(0, -2).join(' '),
    lastName: parts[parts.length - 2],
    secondLastName: parts[parts.length - 1],
  };
};

export const inferIdentityStatus = (
  data: DemographicSubset,
  isClinicalCribPatient: boolean
): PatientIdentityStatus => {
  if (data.identityStatus) {
    return data.identityStatus;
  }

  if (!isClinicalCribPatient) {
    return 'official';
  }

  const hasSplitName = Boolean(
    data.firstName?.trim() || data.lastName?.trim() || data.secondLastName?.trim()
  );
  const normalizedRut = (data.rut || '').trim();
  const hasOfficialRut = normalizedRut.length > 0 && normalizedRut !== '-';

  return hasSplitName || hasOfficialRut ? 'official' : 'provisional';
};

export const buildLocalData = (
  data: DemographicSubset,
  isClinicalCribPatient: boolean
): LocalDemographicsState => {
  const initialNameParts =
    data.firstName || data.lastName || data.secondLastName
      ? {
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          secondLastName: data.secondLastName || '',
        }
      : splitFromLegacyName(data.patientName || '');

  return {
    firstName: initialNameParts.firstName,
    lastName: initialNameParts.lastName,
    secondLastName: initialNameParts.secondLastName,
    provisionalName: normalizeNamePart(data.patientName || ''),
    identityStatus: inferIdentityStatus(data, isClinicalCribPatient),
    rut: data.rut || '',
    documentType: (data.documentType || 'RUT') as DocumentType,
    birthDate: data.birthDate || '',
    insurance: (data.insurance || 'Fonasa') as Insurance,
    admissionOrigin: (data.admissionOrigin || '') as AdmissionOrigin | '',
    admissionOriginDetails: data.admissionOriginDetails || '',
    origin: (data.origin || 'Residente') as Origin,
    isRapanui: data.isRapanui || false,
    biologicalSex: (data.biologicalSex || 'Indeterminado') as BiologicalSex,
  };
};

export const calculateFormattedAge = (dob: string) => {
  if (!dob) return '';
  const birth = new Date(dob);
  const today = new Date();

  const diffTime = today.getTime() - birth.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '';

  if (diffDays < 30) {
    return `${diffDays}d`;
  }

  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) {
    months--;
  }

  if (months <= 24) {
    return `${months}m`;
  }

  const years = Math.floor(months / 12);
  return `${years}a`;
};
