import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  GENERAL_LOGIN_ROLES,
  MANAGED_ASSIGNABLE_ROLES,
  CLINICAL_CALLABLE_ROLES,
} = require('../../../functions/lib/auth/authConfig.js');

describe('functions authConfig', () => {
  it('keeps doctor_specialist inside general login roles', () => {
    expect(GENERAL_LOGIN_ROLES.has('doctor_specialist')).toBe(true);
  });

  it('keeps viewer_census outside general login roles but inside clinical callable roles', () => {
    expect(GENERAL_LOGIN_ROLES.has('viewer_census')).toBe(false);
    expect(CLINICAL_CALLABLE_ROLES.has('viewer_census')).toBe(true);
  });

  it('allows only managed web roles in assignable roles set', () => {
    expect(MANAGED_ASSIGNABLE_ROLES.has('viewer')).toBe(true);
    expect(MANAGED_ASSIGNABLE_ROLES.has('doctor_specialist')).toBe(true);
    expect(MANAGED_ASSIGNABLE_ROLES.has('viewer_census')).toBe(false);
  });
});
