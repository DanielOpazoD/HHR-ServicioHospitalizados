/* @flake-safe: Date usage aligns emulator write-window assertions with current execution time. */
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesTestEnvironment, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDoc } from 'firebase/firestore';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';
import { resolveFirestoreRulesEmulatorConfig } from '@/tests/security/firestoreRulesEmulatorConfig';

const runEmulatorTests =
  process.env.RUN_FIRESTORE_EMULATOR_TESTS === '1' ||
  process.env.FIRESTORE_EMULATOR_HOST !== undefined;

const describeEmulator = runEmulatorTests ? describe : describe.skip;

let activeDb: unknown;

vi.mock('@/firebaseConfig', () => ({
  get db() {
    return activeDb;
  },
  auth: null,
}));

import {
  ConcurrencyError,
  saveRecordToFirestore,
  updateRecordPartial,
} from '@/services/storage/firestore/firestoreRecordWrites';
import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import { getRecordDocRef } from '@/services/storage/firestore/firestoreShared';
import { updatePartial } from '@/services/repositories/dailyRecordRepositoryWriteService';
import {
  clearAllRecords,
  getRecordForDate,
  saveRecord,
} from '@/services/storage/indexeddb/indexedDbRecordService';
import { clearAllSyncQueue, processSyncQueue } from '@/services/storage/sync';

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
  patientName: 'Paciente Movido',
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

const buildEmptyBed = (bedId: string): PatientData =>
  buildPatient(bedId, {
    patientName: '',
    rut: '',
    age: '',
    pathology: '',
    status: PatientStatus.EMPTY,
    admissionDate: '',
    hasWristband: true,
  });

const CURRENT_RECORD_DATE = new Date().toISOString().slice(0, 10);

const isoAt = (date: string, time: string): string => `${date}T${time}.000Z`;

describeEmulator('Firestore emulator sync concurrency flow', () => {
  let testEnv: RulesTestEnvironment;
  let nurseDb: unknown;

  beforeAll(async () => {
    const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    const emulatorConfig = resolveFirestoreRulesEmulatorConfig(process.env.FIRESTORE_EMULATOR_HOST);

    testEnv = await initializeTestEnvironment({
      projectId: 'demo-hhr-sync-emulator-test',
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
    activeDb = nurseDb;
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('throws ConcurrencyError when expectedLastUpdated is older than remote', async () => {
    const date = CURRENT_RECORD_DATE;
    await testEnv.withSecurityRulesDisabled(async context => {
      await context
        .firestore()
        .doc(`hospitals/hanga_roa/dailyRecords/${date}`)
        .set({
          ...buildRecord(date, isoAt(date, '10:00:00')),
          handoffNovedadesDayShift: 'remote',
        });
    });

    const local = buildRecord(date, isoAt(date, '09:59:00'));
    local.handoffNovedadesDayShift = 'local';

    await expect(saveRecordToFirestore(local, isoAt(date, '09:59:00'))).rejects.toBeInstanceOf(
      ConcurrencyError
    );

    let remoteSnap: { data: () => Record<string, unknown> | undefined } | undefined;
    await testEnv.withSecurityRulesDisabled(async context => {
      remoteSnap = await context.firestore().doc(`hospitals/hanga_roa/dailyRecords/${date}`).get();
    });
    expect(remoteSnap?.data()?.handoffNovedadesDayShift).toBe('remote');
  });

  it('saves when expectedLastUpdated matches remote baseline', async () => {
    const date = CURRENT_RECORD_DATE;
    await testEnv.withSecurityRulesDisabled(async context => {
      await context
        .firestore()
        .doc(`hospitals/hanga_roa/dailyRecords/${date}`)
        .set({
          ...buildRecord(date, isoAt(date, '09:00:00')),
          handoffNovedadesNightShift: 'remote baseline',
        });
    });

    const local = buildRecord(date, isoAt(date, '09:00:00'));
    local.handoffNovedadesNightShift = 'local update';

    await expect(saveRecordToFirestore(local, isoAt(date, '09:00:00'))).resolves.toBeUndefined();

    const persisted = await getRecordFromFirestore(date);
    expect(persisted?.handoffNovedadesNightShift).toBe('local update');
  });

  it('rejects partial update on missing doc due security rules precondition', async () => {
    const date = CURRENT_RECORD_DATE;

    // Known emulator limitation:
    // Firestore still reports an evaluation error for this denied update against a missing document,
    // even though the effective contract we care about remains stable: the write is rejected with
    // permission-denied and no document is created. See docs/FIRESTORE_RULES_COMPLEXITY_AUDIT.md.
    await expect(
      updateRecordPartial(date, { 'beds.R1.patientName': 'Paciente Fallback' })
    ).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('applies partial update when record exists and is within nurse edit window', async () => {
    const date = CURRENT_RECORD_DATE;
    const now = Date.now();
    await testEnv.withSecurityRulesDisabled(async context => {
      await context
        .firestore()
        .doc(`hospitals/hanga_roa/dailyRecords/${date}`)
        .set({
          ...buildRecord(date, isoAt(date, '07:00:00')),
          dateTimestamp: now,
        });
    });

    await expect(
      updateRecordPartial(date, {
        'beds.R1.patientName': 'Paciente Parcial',
        'beds.R1.pathology': 'Dx Parcial',
      })
    ).resolves.toBeUndefined();

    const snap = await getDoc(getRecordDocRef(date));
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.beds?.R1?.patientName).toBe('Paciente Parcial');
  });

  it('auto-merges a conflicted bed move and persists no duplicate patient after retry', async () => {
    const date = CURRENT_RECORD_DATE;
    const staleBaseline = isoAt(date, '09:00:00');
    const remoteUpdated = isoAt(date, '10:00:00');
    const movedRut = '22.222.222-2';

    const localBaseline = buildRecord(date, staleBaseline);
    localBaseline.beds = {
      R1: buildPatient('R1', {
        patientName: 'Paciente Movido',
        rut: movedRut,
        admissionDate: '2026-02-10',
        pathology: 'Diagnostico base',
      }),
      R2: buildEmptyBed('R2'),
    };

    const remoteStillStale = buildRecord(date, remoteUpdated);
    remoteStillStale.beds = {
      R1: buildPatient('R1', {
        patientName: 'Paciente Movido',
        rut: movedRut,
        admissionDate: '2026-02-10',
        pathology: 'Diagnostico remoto antiguo',
      }),
      R2: buildEmptyBed('R2'),
    };

    await saveRecord(localBaseline);
    await testEnv.withSecurityRulesDisabled(async context => {
      await context
        .firestore()
        .doc(`hospitals/hanga_roa/dailyRecords/${date}`)
        .set(remoteStillStale);
    });

    const movedPatient = {
      ...localBaseline.beds.R1,
      bedId: 'R2',
      location: localBaseline.beds.R2.location,
    };
    const clearedSource = {
      ...localBaseline.beds.R2,
      bedId: 'R1',
      location: localBaseline.beds.R1.location,
    };

    await updatePartial(date, {
      'beds.R2': movedPatient,
      'beds.R1': clearedSource,
    });

    const localAfterConflict = await getRecordForDate(date);
    expect(localAfterConflict?.beds.R1.patientName).toBe('');
    expect(localAfterConflict?.beds.R2.patientName).toBe('Paciente Movido');

    await processSyncQueue();

    const persisted = await getRecordFromFirestore(date);
    expect(persisted?.beds.R1.patientName).toBe('');
    expect(persisted?.beds.R1.rut).toBe('');
    expect(persisted?.beds.R2.patientName).toBe('Paciente Movido');
    expect(persisted?.beds.R2.rut).toBe(movedRut);
    expect(persisted?.beds.R2.admissionDate).toBe('2026-02-10');

    const matchingBeds = Object.values(persisted?.beds || {}).filter(
      patient => patient.rut === movedRut
    );
    expect(matchingBeds).toHaveLength(1);
  });
});
