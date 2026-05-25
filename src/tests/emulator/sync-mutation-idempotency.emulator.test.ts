/* @flake-safe: Date usage aligns emulator write-window assertions with current execution time. */
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';
import { resolveFirestoreRulesEmulatorConfig } from '@/tests/security/firestoreRulesEmulatorConfig';

const { mockAuthorityCallable } = vi.hoisted(() => ({
  mockAuthorityCallable: vi.fn(),
}));

const runEmulatorTests =
  process.env.RUN_FIRESTORE_EMULATOR_TESTS === '1' ||
  process.env.FIRESTORE_EMULATOR_HOST !== undefined;

const describeEmulator = runEmulatorTests ? describe : describe.skip;

let activeDb: unknown;
type TestFirestore = ReturnType<
  ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']
>;

vi.mock('@/firebaseConfig', () => ({
  get db() {
    return activeDb;
  },
  auth: null,
}));

vi.mock('@/services/storage/firestore/dailyRecordAuthorityCallableClient', () => ({
  saveDailyRecordWithClinicalAuthorityCallable: (...args: unknown[]) =>
    mockAuthorityCallable(...args),
}));

import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import { setFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { clearAllRecords, saveRecord } from '@/services/storage/indexeddb/indexedDbRecordService';
import {
  clearAllSyncQueue,
  getSyncQueueStats,
  processSyncQueue,
  queueDailyRecordSyncTaskWithLocalRecord,
} from '@/services/storage/sync';

const CURRENT_RECORD_DATE = new Date().toISOString().slice(0, 10);
const isoAt = (date: string, time: string): string => `${date}T${time}.000Z`;

const buildRecord = (date: string, lastUpdated: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated,
  nurses: [],
  activeExtraBeds: [],
  dateTimestamp: Date.parse(`${date}T00:00:00.000Z`),
});

const buildPatient = (bedId: string, overrides: Partial<PatientData> = {}): PatientData => ({
  bedId,
  isBlocked: false,
  bedMode: 'Cama',
  hasCompanionCrib: false,
  patientName: 'Paciente Idempotente',
  rut: '33.333.333-3',
  age: '40a',
  pathology: 'Diagnostico base',
  specialty: Specialty.MEDICINA,
  status: PatientStatus.ESTABLE,
  admissionDate: '2026-02-10',
  hasWristband: false,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
  ...overrides,
});

describeEmulator('Firestore emulator mutation idempotency', () => {
  let testEnv: RulesTestEnvironment;
  let nurseDb: TestFirestore;

  beforeAll(async () => {
    const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    const emulatorConfig = resolveFirestoreRulesEmulatorConfig(process.env.FIRESTORE_EMULATOR_HOST);

    testEnv = await initializeTestEnvironment({
      projectId: 'demo-hhr-sync-mutation-idempotency-test',
      firestore: {
        rules,
        host: emulatorConfig.host,
        port: emulatorConfig.port,
      },
    });

    nurseDb = testEnv
      .authenticatedContext('user_nurse', {
        email: 'hospitalizados@hospitalhangaroa.cl',
        role: 'nurse_hospital',
      })
      .firestore();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await clearAllRecords();
    await clearAllSyncQueue();
    mockAuthorityCallable.mockReset();
    (import.meta.env as Record<string, string | undefined>).VITE_DAILY_RECORD_AUTHORITY_MODE =
      'enforced';
    setFirestoreEnabled(true);
    activeDb = nurseDb;
  });

  afterAll(async () => {
    delete (import.meta.env as Record<string, string | undefined>).VITE_DAILY_RECORD_AUTHORITY_MODE;
    await testEnv.cleanup();
  });

  it('drains an already-applied mutationId without calling the enforced authority callable', async () => {
    const date = CURRENT_RECORD_DATE;
    const mutationId = 'mutation-emulator-already-applied';
    const localRecord = buildRecord(date, isoAt(date, '10:00:00'));
    localRecord.beds = {
      R1: buildPatient('R1', { pathology: 'Diagnostico local pendiente' }),
    };

    const remoteAlreadyApplied = buildRecord(date, isoAt(date, '10:05:00'));
    remoteAlreadyApplied.beds = {
      R1: buildPatient('R1', { pathology: 'Diagnostico ya aplicado' }),
    };

    await saveRecord(localRecord);
    await testEnv.withSecurityRulesDisabled(async context => {
      await context
        .firestore()
        .doc(`hospitals/hanga_roa/dailyRecords/${date}`)
        .set({
          ...remoteAlreadyApplied,
          meta: {
            revision: 4,
            lastMutationId: mutationId,
            lastChangedPaths: ['beds.R1.pathology'],
          },
        });
    });

    await queueDailyRecordSyncTaskWithLocalRecord(localRecord, {
      contexts: ['clinical'],
      origin: 'direct_queue',
      syncContract: {
        expectedVersion: isoAt(date, '09:55:00'),
        changedPaths: ['beds.R1.pathology'],
        mutationId,
      },
    });

    await processSyncQueue();

    expect(mockAuthorityCallable).not.toHaveBeenCalled();
    await expect(getSyncQueueStats()).resolves.toMatchObject({
      pending: 0,
      failed: 0,
      conflict: 0,
    });
    const remote = await getRecordFromFirestore(date);
    expect(remote?.beds.R1.pathology).toBe('Diagnostico ya aplicado');
  });
});
