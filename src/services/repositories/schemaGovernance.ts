import { CURRENT_SCHEMA_VERSION, LEGACY_SCHEMA_VERSION } from '@/constants/version';
import { DailyRecord } from '@/types';

export interface SchemaMigrationPlan {
  sourceVersion: number;
  targetVersion: number;
  appliedSteps: string[];
  skipped: boolean;
}

export interface SchemaMigrationResult {
  record: DailyRecord;
  plan: SchemaMigrationPlan;
}

type SchemaMigrator = (record: DailyRecord, date: string) => DailyRecord;

const schemaMigrators: Record<number, SchemaMigrator> = {
  0: (record: DailyRecord) => ({
    ...record,
    schemaVersion: 1,
  }),
};

export interface SchemaGovernanceIntegrity {
  ok: boolean;
  currentVersion: number;
  legacyVersion: number;
  expectedMigratorKeys: number[];
  configuredMigratorKeys: number[];
  missingMigrators: number[];
  extraMigrators: number[];
}

export const getSchemaMigratorRegistry = (): Readonly<Record<number, SchemaMigrator>> =>
  schemaMigrators;

export const getSchemaGovernanceIntegrity = (): SchemaGovernanceIntegrity => {
  const configuredMigratorKeys = Object.keys(schemaMigrators)
    .map(key => Number(key))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const expectedMigratorKeys: number[] = [];
  for (let version = LEGACY_SCHEMA_VERSION; version < CURRENT_SCHEMA_VERSION; version += 1) {
    expectedMigratorKeys.push(version);
  }

  const missingMigrators = expectedMigratorKeys.filter(
    key => !configuredMigratorKeys.includes(key)
  );
  const extraMigrators = configuredMigratorKeys.filter(key => !expectedMigratorKeys.includes(key));

  return {
    ok: missingMigrators.length === 0 && extraMigrators.length === 0,
    currentVersion: CURRENT_SCHEMA_VERSION,
    legacyVersion: LEGACY_SCHEMA_VERSION,
    expectedMigratorKeys,
    configuredMigratorKeys,
    missingMigrators,
    extraMigrators,
  };
};

export const assertSchemaGovernanceIntegrity = (): void => {
  const integrity = getSchemaGovernanceIntegrity();
  if (integrity.ok) return;

  throw new Error(
    `[SchemaGovernance] Invalid migrator registry. ` +
      `Missing: [${integrity.missingMigrators.join(', ')}]. ` +
      `Extra: [${integrity.extraMigrators.join(', ')}]. ` +
      `Expected keys for v${integrity.legacyVersion}..v${integrity.currentVersion - 1}.`
  );
};

export const resolveSchemaVersion = (record: Partial<DailyRecord> | null | undefined): number => {
  const rawVersion = record?.schemaVersion;
  if (typeof rawVersion !== 'number' || !Number.isFinite(rawVersion)) {
    return LEGACY_SCHEMA_VERSION;
  }
  if (rawVersion < LEGACY_SCHEMA_VERSION) {
    return LEGACY_SCHEMA_VERSION;
  }
  return Math.floor(rawVersion);
};

export const migrateRecordSchemaToCurrent = (
  record: DailyRecord,
  date: string
): SchemaMigrationResult => {
  const sourceVersion = resolveSchemaVersion(record);

  if (sourceVersion >= CURRENT_SCHEMA_VERSION) {
    return {
      record: {
        ...record,
        schemaVersion: sourceVersion,
      },
      plan: {
        sourceVersion,
        targetVersion: CURRENT_SCHEMA_VERSION,
        appliedSteps: [],
        skipped: sourceVersion > CURRENT_SCHEMA_VERSION,
      },
    };
  }

  let cursor = sourceVersion;
  let migrated = record;
  const appliedSteps: string[] = [];

  while (cursor < CURRENT_SCHEMA_VERSION) {
    const migrator = schemaMigrators[cursor];
    if (!migrator) {
      throw new Error(
        `[SchemaGovernance] Missing schema migrator from v${cursor} to v${cursor + 1}.`
      );
    }

    migrated = migrator(migrated, date);
    appliedSteps.push(`v${cursor}->v${cursor + 1}`);
    cursor += 1;
  }

  return {
    record: {
      ...migrated,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
    plan: {
      sourceVersion,
      targetVersion: CURRENT_SCHEMA_VERSION,
      appliedSteps,
      skipped: false,
    },
  };
};

export const isSchemaVersionAhead = (record: Partial<DailyRecord> | null | undefined): boolean =>
  resolveSchemaVersion(record) > CURRENT_SCHEMA_VERSION;
