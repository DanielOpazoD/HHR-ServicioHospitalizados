import { describe, it, expect } from 'vitest';
import {
  migrateLegacyData,
  migrateLegacyDataWithReport,
} from '@/services/repositories/dataMigration';
import type { DailyRecord } from '@/types';
import { DataFactory } from '@/tests/factories/DataFactory';

type LegacyDailyRecord = DailyRecord & {
  nurseName?: string;
  tens?: string[];
};

describe('Data Migration Service - Staff Fields', () => {
  const mockDate = '2025-01-01';
  const createBaseRecord = (overrides: Partial<LegacyDailyRecord>): LegacyDailyRecord =>
    ({
      ...DataFactory.createMockDailyRecord(mockDate),
      ...overrides,
    }) as LegacyDailyRecord;

  it('should migrate legacy nurses array to nursesDayShift', () => {
    const legacyRecord = createBaseRecord({
      nurses: ['Nurse A', 'Nurse B'],
      beds: {},
    });

    const migrated = migrateLegacyData(legacyRecord, mockDate);

    expect(migrated.nursesDayShift).toEqual(['Nurse A', 'Nurse B']);
  });

  it('should migrate legacy nurseName to first element of nursesDayShift', () => {
    const legacyRecord = createBaseRecord({
      nurseName: 'Nurse Single',
      beds: {},
    });

    const migrated = migrateLegacyData(legacyRecord, mockDate);

    expect(migrated.nursesDayShift?.[0]).toBe('Nurse Single');
  });

  it('should migrate legacy tens array to tensDayShift', () => {
    const legacyRecord = createBaseRecord({
      tens: ['TENS 1', 'TENS 2'],
      beds: {},
    });

    const migrated = migrateLegacyData(legacyRecord, mockDate);

    expect(migrated.tensDayShift).toEqual(['TENS 1', 'TENS 2', '']);
  });

  it('should not overwrite existing nursesDayShift with legacy data', () => {
    const record = createBaseRecord({
      nurses: ['Old Nurse'],
      nursesDayShift: ['New Nurse', 'Second Nurse'],
      beds: {},
    });

    const migrated = migrateLegacyData(record, mockDate);

    expect(migrated.nursesDayShift).toEqual(['New Nurse', 'Second Nurse']);
  });

  it('should handle empty/missing staff fields gracefully', () => {
    const record = createBaseRecord({
      beds: {},
    });

    const migrated = migrateLegacyData(record, mockDate);

    expect(migrated.nursesDayShift).toEqual([]);
    expect(migrated.nursesNightShift).toEqual([]);
    expect(migrated.tensDayShift).toEqual([]);
    expect(migrated.tensNightShift).toEqual([]);
  });

  it('should normalize sparse legacy records to the current schema floor', () => {
    const record = createBaseRecord({
      beds: {
        R1: {
          ...DataFactory.createMockPatient('R1'),
          patientName: 'Paciente Legacy',
        },
      },
      schemaVersion: 0,
    });

    const migrated = migrateLegacyData(record, mockDate);

    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.beds.R1.patientName).toBe('Paciente Legacy');
    expect(Object.keys(migrated.beds).length).toBeGreaterThan(1);
  });

  it('should report the legacy compatibility rules that were applied', () => {
    const record = createBaseRecord({
      nurseName: 'Nurse Legacy',
      tens: ['TENS 1'],
      beds: {
        R1: {
          ...DataFactory.createMockPatient('R1'),
          patientName: 'Paciente Legacy',
        },
      },
      schemaVersion: 0,
    });

    const migrated = migrateLegacyDataWithReport(record, mockDate);

    expect(migrated.record.schemaVersion).toBe(1);
    expect(migrated.appliedRules).toContain('schema_defaults_applied');
    expect(migrated.appliedRules).toContain('record_invariants_normalized');
    expect(migrated.appliedRules).toContain('legacy_single_nurse_promoted');
    expect(migrated.appliedRules).toContain('legacy_tens_promoted_to_day_shift');
    expect(migrated.appliedRules).toContain('schema_version_floor_enforced');
    expect(migrated.compatibilityIntensity).toBe('legacy_schema_bridge');
    expect(migrated.compatibilityDisposition).toBe('legacy_bridge');
    expect(migrated.schemaPlan.appliedSteps).toContain('v0->v1');
  });

  it('classifies normalized current records as normalized_only compatibility', () => {
    const record = createBaseRecord({
      beds: {},
      schemaVersion: 1,
    });

    const migrated = migrateLegacyDataWithReport(record, mockDate);

    expect(migrated.compatibilityIntensity).toBe('normalized_only');
    expect(migrated.compatibilityDisposition).toBe('current');
  });
});
