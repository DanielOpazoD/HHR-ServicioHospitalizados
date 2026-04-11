/**
 * Tests for the global search contracts and shared helpers.
 * Validates episode key parsing used by the search hook.
 */

import { describe, it, expect } from 'vitest';

// We test the parseCompositeEpisodeKey logic indirectly through the hook's
// internal behavior. Here we test the normalizePatientSearchTerm from
// patientMasterContracts since it was modified for case-insensitive search.

import { normalizePatientSearchTerm } from '@/services/repositories/contracts/patientMasterContracts';

describe('normalizePatientSearchTerm (case-insensitive search)', () => {
  it('converts lowercase to title case', () => {
    expect(normalizePatientSearchTerm('alicia')).toBe('Alicia');
  });

  it('converts uppercase to title case', () => {
    expect(normalizePatientSearchTerm('ALICIA')).toBe('Alicia');
  });

  it('handles multiple words', () => {
    expect(normalizePatientSearchTerm('juan pablo')).toBe('Juan Pablo');
  });

  it('handles mixed case input', () => {
    expect(normalizePatientSearchTerm('mArÍa GONZÁLEZ')).toBe('María González');
  });

  it('trims whitespace', () => {
    expect(normalizePatientSearchTerm('  alicia  ')).toBe('Alicia');
  });

  it('returns empty string for empty input', () => {
    expect(normalizePatientSearchTerm('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizePatientSearchTerm('   ')).toBe('');
  });

  it('preserves single character words', () => {
    expect(normalizePatientSearchTerm('a b c')).toBe('A B C');
  });
});
