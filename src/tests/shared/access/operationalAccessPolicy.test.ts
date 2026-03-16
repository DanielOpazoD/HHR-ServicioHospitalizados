import { describe, expect, it } from 'vitest';
import {
  canForceCreateDayCopyOverride,
  canVerifyArchiveStatusForModule,
} from '@/shared/access/operationalAccessPolicy';

describe('operationalAccessPolicy', () => {
  it('allows only admin to force day copy override', () => {
    expect(canForceCreateDayCopyOverride('admin')).toBe(true);
    expect(canForceCreateDayCopyOverride('doctor_specialist')).toBe(false);
    expect(canForceCreateDayCopyOverride('nurse_hospital')).toBe(false);
  });

  it('allows archive verification only for editable census and nursing handoff modules', () => {
    expect(canVerifyArchiveStatusForModule('admin', 'CENSUS')).toBe(true);
    expect(canVerifyArchiveStatusForModule('nurse_hospital', 'NURSING_HANDOFF')).toBe(true);
    expect(canVerifyArchiveStatusForModule('doctor_specialist', 'CENSUS')).toBe(false);
    expect(canVerifyArchiveStatusForModule('doctor_specialist', 'MEDICAL_HANDOFF')).toBe(false);
  });
});
