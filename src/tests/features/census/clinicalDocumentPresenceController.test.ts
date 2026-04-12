/**
 * Tests for clinical document presence controller.
 *
 * Validates that document counts are correctly aggregated per
 * episode key and mapped to bed IDs for badge display.
 */

import { describe, it, expect } from 'vitest';
import {
  buildActiveClinicalDocumentEpisodeKeys,
  buildClinicalDocumentPresenceByBed,
  buildClinicalDocumentPresenceInfoByBed,
  type BedEpisodeBinding,
} from '@/features/census/controllers/clinicalDocumentPresenceController';

const bindings: BedEpisodeBinding[] = [
  { bedId: 'R1', episodeKey: '12345678-9__2026-01-10' },
  { bedId: 'R2', episodeKey: '98765432-1__2026-02-15' },
  { bedId: 'NEO1', episodeKey: '11111111-1__2026-03-01' },
];

const records = [
  { status: 'published', episodeKey: '12345678-9__2026-01-10' },
  { status: 'draft', episodeKey: '12345678-9__2026-01-10' },
  { status: 'published', episodeKey: '98765432-1__2026-02-15' },
  { status: 'archived', episodeKey: '12345678-9__2026-01-10' },
  { status: 'archived', episodeKey: '11111111-1__2026-03-01' },
];

describe('clinicalDocumentPresenceController', () => {
  describe('buildActiveClinicalDocumentEpisodeKeys', () => {
    it('returns only episode keys with non-archived documents', () => {
      const keys = buildActiveClinicalDocumentEpisodeKeys(records);

      expect(keys.has('12345678-9__2026-01-10')).toBe(true);
      expect(keys.has('98765432-1__2026-02-15')).toBe(true);
      expect(keys.has('11111111-1__2026-03-01')).toBe(false);
    });

    it('returns empty set for undefined records', () => {
      expect(buildActiveClinicalDocumentEpisodeKeys(undefined).size).toBe(0);
    });

    it('returns empty set for empty array', () => {
      expect(buildActiveClinicalDocumentEpisodeKeys([]).size).toBe(0);
    });
  });

  describe('buildClinicalDocumentPresenceByBed', () => {
    it('maps bed IDs to boolean presence', () => {
      const activeKeys = buildActiveClinicalDocumentEpisodeKeys(records);
      const result = buildClinicalDocumentPresenceByBed(bindings, activeKeys);

      expect(result).toEqual({
        R1: true,
        R2: true,
        NEO1: false,
      });
    });
  });

  describe('buildClinicalDocumentPresenceInfoByBed', () => {
    it('counts total and draft documents per bed', () => {
      const result = buildClinicalDocumentPresenceInfoByBed(bindings, records);

      expect(result.R1).toEqual({
        present: true,
        totalCount: 2,
        draftCount: 1,
      });
    });

    it('counts published documents correctly', () => {
      const result = buildClinicalDocumentPresenceInfoByBed(bindings, records);

      expect(result.R2).toEqual({
        present: true,
        totalCount: 1,
        draftCount: 0,
      });
    });

    it('returns zero counts for beds with only archived documents', () => {
      const result = buildClinicalDocumentPresenceInfoByBed(bindings, records);

      expect(result.NEO1).toEqual({
        present: false,
        totalCount: 0,
        draftCount: 0,
      });
    });

    it('handles undefined records', () => {
      const result = buildClinicalDocumentPresenceInfoByBed(bindings, undefined);

      expect(result.R1.totalCount).toBe(0);
      expect(result.R1.present).toBe(false);
    });

    it('handles empty bindings', () => {
      const result = buildClinicalDocumentPresenceInfoByBed([], records);

      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
