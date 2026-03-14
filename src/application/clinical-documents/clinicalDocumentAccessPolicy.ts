import type { UserRole } from '@/types';

export const canReadClinicalDocuments = (role: UserRole | undefined): boolean =>
  role === 'admin' ||
  role === 'doctor_urgency' ||
  role === 'doctor_specialist' ||
  role === 'nurse_hospital' ||
  role === 'editor';

export const canEditClinicalDocuments = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'doctor_urgency';

export const canArchiveClinicalDocuments = (role: UserRole | undefined): boolean =>
  role === 'admin';

export const canDeleteClinicalDocuments = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'doctor_urgency' || role === 'nurse_hospital' || role === 'editor';
