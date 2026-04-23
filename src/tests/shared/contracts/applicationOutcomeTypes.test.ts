import { describe, expect, it } from 'vitest';
import {
  hasApplicationIssues,
  isApplicationOutcomeNonFailure,
  isApplicationOutcomeSuccess,
  type ApplicationOutcome,
} from '@/shared/contracts/applicationOutcomeTypes';

describe('applicationOutcomeTypes helpers', () => {
  const createOutcome = <T>(status: ApplicationOutcome<T>['status']): ApplicationOutcome<T> => ({
    status,
    data: null as T,
    issues: status === 'success' ? [] : [{ kind: 'unknown', message: 'Issue' }],
  });

  it('detects success outcomes precisely', () => {
    expect(isApplicationOutcomeSuccess(createOutcome('success'))).toBe(true);
    expect(isApplicationOutcomeSuccess(createOutcome('partial'))).toBe(false);
    expect(isApplicationOutcomeSuccess(createOutcome('failed'))).toBe(false);
  });

  it('detects non-failure outcomes across success partial and degraded', () => {
    expect(isApplicationOutcomeNonFailure(createOutcome('success'))).toBe(true);
    expect(isApplicationOutcomeNonFailure(createOutcome('partial'))).toBe(true);
    expect(isApplicationOutcomeNonFailure(createOutcome('degraded'))).toBe(true);
    expect(isApplicationOutcomeNonFailure(createOutcome('failed'))).toBe(false);
  });

  it('reports whether an outcome carries issues', () => {
    expect(hasApplicationIssues(createOutcome('success'))).toBe(false);
    expect(hasApplicationIssues(createOutcome('failed'))).toBe(true);
  });
});
