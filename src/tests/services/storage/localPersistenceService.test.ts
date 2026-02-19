import { beforeEach, describe, expect, it } from 'vitest';
import { localPersistence } from '@/services/storage/localpersistence/localPersistenceService';
import { DailyRecord } from '@/types';

const makeRecord = (date: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: new Date().toISOString(),
  nurses: [],
  activeExtraBeds: [],
});

describe('localPersistenceService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('records', () => {
    it('saves and retrieves record maps', () => {
      localPersistence.records.save(makeRecord('2026-02-18'));
      localPersistence.records.save(makeRecord('2026-02-19'));

      const all = localPersistence.records.getAll();
      expect(Object.keys(all)).toHaveLength(2);
      expect(localPersistence.records.getForDate('2026-02-18')?.date).toBe('2026-02-18');
    });

    it('filters by month and resolves previous date', () => {
      localPersistence.records.save(makeRecord('2026-01-01'));
      localPersistence.records.save(makeRecord('2026-01-03'));
      localPersistence.records.save(makeRecord('2026-02-01'));

      expect(localPersistence.records.getRecordsForMonth(2026, 1)).toHaveLength(2);
      expect(localPersistence.records.getPreviousDayRecord('2026-01-10')?.date).toBe('2026-01-03');
    });
  });

  describe('settings', () => {
    it('persists and reads setting values', () => {
      localPersistence.settings.save('feature_x', { enabled: true });
      const value = localPersistence.settings.get('feature_x', { enabled: false });
      expect(value).toEqual({ enabled: true });
    });

    it('clears tracked settings only', () => {
      localStorage.setItem('untracked_key', 'keep');
      localPersistence.settings.save('tracked_a', 1);
      localPersistence.settings.save('tracked_b', 2);

      localPersistence.settings.clearAll();

      expect(localStorage.getItem('tracked_a')).toBeNull();
      expect(localStorage.getItem('tracked_b')).toBeNull();
      expect(localStorage.getItem('untracked_key')).toBe('keep');
    });
  });
});
