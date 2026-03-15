import { describe, expect, it } from 'vitest';
import {
  GENERAL_LOGIN_ROLES,
  getManagedRoleOptions,
  isGeneralLoginRole,
  isManagedUserRole,
  resolveRoleAccess,
} from '@/shared/access/roleAccessMatrix';

describe('roleAccessMatrix', () => {
  it('allows doctor_specialist as a general login role', () => {
    expect(isGeneralLoginRole('doctor_specialist')).toBe(true);
    expect(GENERAL_LOGIN_ROLES).toContain('doctor_specialist');
  });

  it('keeps shared census viewer outside the general login roles', () => {
    expect(isGeneralLoginRole('viewer_census')).toBe(false);
  });

  it('exposes only managed roles in role management options', () => {
    expect(getManagedRoleOptions().map(option => option.role)).toEqual([
      'admin',
      'nurse_hospital',
      'doctor_urgency',
      'doctor_specialist',
      'viewer',
    ]);
    expect(isManagedUserRole('doctor_specialist')).toBe(true);
    expect(isManagedUserRole('viewer_census')).toBe(false);
  });

  it('resolves specialist role with restricted census and medical capabilities', () => {
    expect(resolveRoleAccess('doctor_specialist')).toMatchObject({
      modules: ['CENSUS', 'MEDICAL_HANDOFF'],
      canEdit: ['MEDICAL_HANDOFF'],
      censusAccessProfile: 'specialist',
      specialistRestrictedMedicalAccess: true,
      canEditClinicalDocumentDrafts: true,
    });
  });

  it('keeps admin system modules visible in the app shell', () => {
    expect(resolveRoleAccess('admin').modules).toEqual(
      expect.arrayContaining(['PATIENT_MASTER_INDEX', 'DATA_MAINTENANCE', 'DIAGNOSTICS'])
    );
    expect(resolveRoleAccess('admin').canEdit).toEqual(
      expect.arrayContaining(['PATIENT_MASTER_INDEX', 'DATA_MAINTENANCE', 'DIAGNOSTICS'])
    );
  });
});
