import { describe, expect, it } from 'vitest';
import { resolveCensusDateSelection } from '@/components/layout/app-content/appContentCensusDateController';

describe('appContentCensusDateController', () => {
  it('resolves a valid ISO date into census selection fields', () => {
    expect(resolveCensusDateSelection('2026-04-12')).toEqual({
      year: 2026,
      month: 3,
      day: 12,
    });
  });

  it('returns null for malformed ISO-like values', () => {
    expect(resolveCensusDateSelection('2026/04/12')).toBeNull();
    expect(resolveCensusDateSelection('bad-date')).toBeNull();
  });

  it('returns null for impossible calendar dates', () => {
    expect(resolveCensusDateSelection('2026-02-31')).toBeNull();
  });
});
