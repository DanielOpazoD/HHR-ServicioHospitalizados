/**
 * Tests for the FONASA billing code search service.
 */

import { describe, expect, it } from 'vitest';
import { searchFonasa } from '@/services/terminology/fonasaService';

describe('searchFonasa', () => {
  it('returns empty array for short queries', async () => {
    expect(await searchFonasa('interventions', '')).toEqual([]);
    expect(await searchFonasa('interventions', 'a')).toEqual([]);
  });

  it('finds interventions by code prefix', async () => {
    const results = await searchFonasa('interventions', '1103001');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe('1103001');
  });

  it('finds interventions by description keyword', async () => {
    const results = await searchFonasa('interventions', 'apendicectomía');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.description.toLowerCase().includes('apendic'))).toBe(true);
  });

  it('finds procedures by description keyword', async () => {
    const results = await searchFonasa('procedures', 'mamografía');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.description.toLowerCase().includes('mamograf'))).toBe(true);
  });

  it('search is accent-insensitive', async () => {
    const results = await searchFonasa('procedures', 'mamografia');

    expect(results.length).toBeGreaterThan(0);
  });

  it('search is case-insensitive', async () => {
    const results = await searchFonasa('interventions', 'CRANEOPLASTÍA');

    expect(results.length).toBeGreaterThan(0);
  });

  it('returns at most 15 results', async () => {
    const results = await searchFonasa('interventions', 'de');

    expect(results.length).toBeLessThanOrEqual(15);
  });

  it('prioritises code prefix matches over description matches', async () => {
    const results = await searchFonasa('interventions', '1103');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code.startsWith('1103')).toBe(true);
  });
});
