import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { RulesTestEnvironment, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createQueryClientTestWrapper } from '@/tests/utils/queryClientTestUtils';
import { useDailyRecordSyncQuery } from '@/hooks/useDailyRecordSyncQuery';
import { DailyRecord } from '@/types';
import { clearAllRecords, getRecordForDate } from '@/services/storage/indexedDBService';
import { setDemoModeActive, setFirestoreEnabled } from '@/services/repositories/repositoryConfig';

const runEmulatorUiTests =
  process.env.RUN_FIRESTORE_EMULATOR_TESTS === '1' ||
  process.env.FIRESTORE_EMULATOR_HOST !== undefined;

const describeUiEmulator = runEmulatorUiTests ? describe : describe.skip;

const mockNotifyError = vi.fn();
const mockNotifySuccess = vi.fn();
const mockNotifyWarning = vi.fn();
const mockNotifyInfo = vi.fn();

vi.mock('@/context/UIContext', () => ({
  useNotification: () => ({
    error: mockNotifyError,
    success: mockNotifySuccess,
    warning: mockNotifyWarning,
    info: mockNotifyInfo,
    notify: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
    confirm: vi.fn(),
    alert: vi.fn(),
    notifications: [],
  }),
}));

vi.mock('@/context/VersionContext', () => ({
  useVersion: () => ({
    checkVersion: vi.fn(),
    isOutdated: false,
    appVersion: 1,
    remoteVersion: null,
    forceUpdate: vi.fn(),
  }),
}));

vi.mock('@/services/storage/legacyFirebaseService', () => ({
  getLegacyRecord: vi.fn().mockResolvedValue(null),
}));

let activeDb: unknown;
const currentUser = {
  email: 'hospitalizados@hospitalhangaroa.cl',
  uid: 'user_nurse',
  displayName: 'Test Nurse',
};

vi.mock('@/firebaseConfig', () => ({
  get db() {
    return activeDb;
  },
  auth: {
    get currentUser() {
      return currentUser;
    },
  },
  storage: {},
  functions: {},
  firebaseReady: Promise.resolve(),
  mountConfigWarning: vi.fn(),
}));

const buildRecord = (date: string, patientName: string, pathology: string): DailyRecord =>
  ({
    date,
    beds: {
      R1: {
        bedId: 'R1',
        isBlocked: false,
        bedMode: 'Cama',
        hasCompanionCrib: false,
        patientName,
        rut: '11.111.111-1',
        age: '40a',
        pathology,
        specialty: 'Med Interna',
        status: 'Estable',
        admissionDate: date,
        hasWristband: false,
        devices: [],
        surgicalComplication: false,
        isUPC: false,
      },
    },
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: `${date}T10:00:00.000Z`,
    nurses: [],
    nursesDayShift: [],
    nursesNightShift: [],
    tensDayShift: [],
    tensNightShift: [],
    activeExtraBeds: [],
    schemaVersion: 1,
    dateTimestamp: Date.now(),
    handoffDayChecklist: {},
    handoffNightChecklist: {},
  }) as unknown as DailyRecord;

describeUiEmulator('UI sync flow with Firestore emulator', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'demo-hhr-ui-sync-emulator-test',
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await testEnv.clearFirestore();
    await clearAllRecords();
    setDemoModeActive(false);
    setFirestoreEnabled(true);

    activeDb = testEnv
      .authenticatedContext('user_nurse', {
        email: 'hospitalizados@hospitalhangaroa.cl',
        role: 'nurse_hospital',
      })
      .firestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('loads record from emulator and reflects remote updates via subscription', async () => {
    const date = '2026-02-22';
    const seed = buildRecord(date, 'Paciente Inicial', 'Diag Inicial');

    await testEnv.withSecurityRulesDisabled(async context => {
      await context.firestore().doc(`hospitals/hanga_roa/dailyRecords/${date}`).set(seed);
    });

    const { wrapper } = createQueryClientTestWrapper();
    const { result } = renderHook(() => useDailyRecordSyncQuery(date, false, true), { wrapper });

    await waitFor(() => {
      expect(result.current.record?.beds?.R1?.patientName).toBe('Paciente Inicial');
    });

    await testEnv.withSecurityRulesDisabled(async context => {
      await context
        .firestore()
        .doc(`hospitals/hanga_roa/dailyRecords/${date}`)
        .set(
          {
            ...seed,
            beds: {
              ...seed.beds,
              R1: { ...seed.beds.R1, patientName: 'Paciente Remoto', pathology: 'Diag Remoto' },
            },
            lastUpdated: `${date}T10:10:00.000Z`,
          },
          { merge: true }
        );
    });

    await waitFor(() => {
      expect(result.current.record?.beds?.R1?.patientName).toBe('Paciente Remoto');
      expect(result.current.record?.beds?.R1?.pathology).toBe('Diag Remoto');
    });
  });

  it('patches from UI hook and persists changes to Firestore + IndexedDB', async () => {
    const date = '2026-02-23';
    const seed = buildRecord(date, 'Paciente Local', 'Diag Base');

    await testEnv.withSecurityRulesDisabled(async context => {
      await context.firestore().doc(`hospitals/hanga_roa/dailyRecords/${date}`).set(seed);
    });

    const { wrapper } = createQueryClientTestWrapper();
    const { result } = renderHook(() => useDailyRecordSyncQuery(date, false, true), { wrapper });

    await waitFor(() => {
      expect(result.current.record?.beds?.R1?.pathology).toBe('Diag Base');
    });

    await act(async () => {
      await result.current.patchRecord({
        'beds.R1.pathology': 'Diag UI Patch',
      });
    });

    await waitFor(() => {
      expect(result.current.record?.beds?.R1?.pathology).toBe('Diag UI Patch');
    });

    let remoteSnap: { data: () => Record<string, unknown> | undefined } | undefined;
    await testEnv.withSecurityRulesDisabled(async context => {
      remoteSnap = await context.firestore().doc(`hospitals/hanga_roa/dailyRecords/${date}`).get();
    });
    const remoteData = remoteSnap?.data() as { beds?: Record<string, { pathology?: string }> };
    expect(remoteData?.beds?.R1?.pathology).toBe('Diag UI Patch');

    const local = await getRecordForDate(date);
    expect(local?.beds?.R1?.pathology).toBe('Diag UI Patch');
  });
});
