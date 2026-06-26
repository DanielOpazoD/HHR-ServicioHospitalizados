/* @flake-safe: Date usage aligns emulator write-window assertions with current execution time. */
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesTestEnvironment, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';
import { resolveFirestoreRulesEmulatorConfig } from '@/tests/security/firestoreRulesEmulatorConfig';

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

import { attemptConflictAutoMergeRecovery } from '@/services/repositories/dailyRecordConflictAutoMergeController';
import { setFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { clearAllRecords } from '@/services/storage/indexeddb/indexedDbRecordService';
import { clearAllSyncQueue } from '@/services/storage/sync';

const buildRecord = (date: string, lastUpdated: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated,
  nurses: [],
  nursesDayShift: [],
  nursesNightShift: [],
  tensDayShift: [],
  tensNightShift: [],
  activeExtraBeds: [],
  dateTimestamp: Date.parse(`${date}T00:00:00.000Z`),
});

const buildPatient = (bedId: string, overrides: Partial<PatientData> = {}): PatientData => ({
  bedId,
  isBlocked: false,
  bedMode: 'Cama',
  hasCompanionCrib: false,
  patientName: 'Paciente',
  rut: '22.222.222-2',
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

const CURRENT_RECORD_DATE = new Date().toISOString().slice(0, 10);
const isoAt = (date: string, time: string): string => `${date}T${time}.000Z`;

describeEmulator('Firestore emulator conflict version recovery', () => {
  let testEnv: RulesTestEnvironment;
  let nurseDb: TestFirestore;

  beforeAll(async () => {
    const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    const emulatorConfig = resolveFirestoreRulesEmulatorConfig(process.env.FIRESTORE_EMULATOR_HOST);

    testEnv = await initializeTestEnvironment({
      projectId: 'demo-hhr-conflict-recovery-test',
      firestore: { rules, host: emulatorConfig.host, port: emulatorConfig.port },
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
    setFirestoreEnabled(true);
    activeDb = nurseDb;
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('captures both pre-merge versions in conflictSnapshots on auto-merge', async () => {
    const date = CURRENT_RECORD_DATE;

    const remote = buildRecord(date, isoAt(date, '10:00:00'));
    remote.beds = { R1: buildPatient('R1', { patientName: 'Remoto', pathology: 'Dx remoto' }) };
    await testEnv.withSecurityRulesDisabled(async context => {
      await context.firestore().doc(`hospitals/hanga_roa/dailyRecords/${date}`).set(remote);
    });

    const incoming = buildRecord(date, isoAt(date, '09:00:00'));
    incoming.beds = { R1: buildPatient('R1', { patientName: 'Local', pathology: 'Dx local' }) };

    await attemptConflictAutoMergeRecovery(date, incoming, ['beds.R1.pathology']);

    // The two pre-merge versions are recoverable, each with `expireAt` for the TTL policy.
    let snapshots: { origin: string; expireAt: unknown; record: unknown }[] = [];
    await testEnv.withSecurityRulesDisabled(async context => {
      const querySnapshot = await context
        .firestore()
        .collection(`hospitals/hanga_roa/dailyRecords/${date}/conflictSnapshots`)
        .get();
      snapshots = querySnapshot.docs.map(snap => snap.data() as never);
    });

    expect(snapshots.map(snap => snap.origin).sort()).toEqual([
      'incoming_premerge',
      'remote_premerge',
    ]);
    expect(snapshots.every(snap => snap.expireAt)).toBe(true);
    expect(snapshots.every(snap => snap.record)).toBe(true);

    const remoteSnap = snapshots.find(snap => snap.origin === 'remote_premerge');
    expect((remoteSnap?.record as DailyRecord)?.beds?.R1?.patientName).toBe('Remoto');
    const incomingSnap = snapshots.find(snap => snap.origin === 'incoming_premerge');
    expect((incomingSnap?.record as DailyRecord)?.beds?.R1?.patientName).toBe('Local');
  });
});
