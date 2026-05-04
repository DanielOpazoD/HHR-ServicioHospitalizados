import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';

vi.mock('@/services/storage/indexeddb/indexedDbRecordService', () => ({
  getRecordForDate: vi.fn(),
  saveRecord: vi.fn(),
}));

vi.mock('@/services/storage/firestore/firestoreRecordWrites', () => ({
  updateRecordPartial: vi.fn(),
  saveRecordToFirestore: vi.fn(),
}));

vi.mock('@/services/storage/sync', () => ({
  isRetryableSyncError: vi.fn(),
  queueSyncTask: vi.fn(),
}));

vi.mock('@/services/repositories/repositoryConfig', () => ({
  isFirestoreEnabled: vi.fn(() => false),
}));

vi.mock('@/utils/recordInvariants', () => ({
  normalizeDailyRecordInvariants: vi.fn((record: DailyRecord) => ({ record, patches: {} })),
}));

vi.mock('@/services/repositories/helpers/validationHelper', () => ({
  validateAndSalvageRecord: vi.fn((record: DailyRecord) => record),
}));

vi.mock('@/services/utils/fhirMappers', () => ({
  mapPatientToFhir: vi.fn(() => ({})),
}));

const warnSpy = vi.fn();
vi.mock('@/services/repositories/repositoryLoggers', () => ({
  dailyRecordWriteLogger: {
    warn: (...args: unknown[]) => warnSpy(...args),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { updatePartial } from '@/services/repositories/dailyRecordRepositoryWriteService';
import { getRecordForDate as getRecordFromIndexedDB } from '@/services/storage/indexeddb/indexedDbRecordService';

const longText = (chars: number) => 'a'.repeat(chars);

const buildPatient = (bedId: string, pathology: string): PatientData => ({
  bedId,
  isBlocked: false,
  bedMode: 'Cama',
  hasCompanionCrib: false,
  patientName: 'Paciente Demo',
  rut: '11.111.111-1',
  age: '40a',
  pathology,
  specialty: Specialty.MEDICINA,
  status: PatientStatus.ESTABLE,
  admissionDate: '2026-02-18',
  hasWristband: false,
  devices: [],
  surgicalComplication: false,
  isUPC: false,
});

const buildRecord = (date: string, pathology: string): DailyRecord => ({
  date,
  beds: { R1: buildPatient('R1', pathology) },
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: '2026-02-19T00:00:00.000Z',
  nurses: [],
  activeExtraBeds: [],
});

describe('dailyRecordRepositoryWriteService field shrinkage telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy.mockClear();
  });

  it('logs a warning when a long string field is replaced by one less than half its length', async () => {
    const current = buildRecord('2026-02-11', longText(80));
    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(current);

    await updatePartial('2026-02-11', {
      'beds.R1.pathology': longText(20),
    });

    const shrinkageCall = warnSpy.mock.calls.find(
      ([msg]) => typeof msg === 'string' && msg.includes('Field shrinkage')
    );
    expect(shrinkageCall).toBeDefined();
    expect(shrinkageCall?.[0]).toContain('beds.R1.pathology');
    expect(shrinkageCall?.[1]).toMatchObject({
      path: 'beds.R1.pathology',
      prevLength: 80,
      nextLength: 20,
    });
  });

  it('does NOT log when shrinkage stays at or above the 50% ratio', async () => {
    const current = buildRecord('2026-02-11', longText(80));
    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(current);

    await updatePartial('2026-02-11', {
      'beds.R1.pathology': longText(60),
    });

    const shrinkageCall = warnSpy.mock.calls.find(
      ([msg]) => typeof msg === 'string' && msg.includes('Field shrinkage')
    );
    expect(shrinkageCall).toBeUndefined();
  });

  it('does NOT log when the previous value is shorter than the 20-char floor', async () => {
    const current = buildRecord('2026-02-11', 'short');
    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(current);

    await updatePartial('2026-02-11', {
      'beds.R1.pathology': 'a',
    });

    const shrinkageCall = warnSpy.mock.calls.find(
      ([msg]) => typeof msg === 'string' && msg.includes('Field shrinkage')
    );
    expect(shrinkageCall).toBeUndefined();
  });

  it('does NOT log when the new value is empty (clearing a field is not shrinkage)', async () => {
    const current = buildRecord('2026-02-11', longText(80));
    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(current);

    await updatePartial('2026-02-11', {
      'beds.R1.pathology': '',
    });

    const shrinkageCall = warnSpy.mock.calls.find(
      ([msg]) => typeof msg === 'string' && msg.includes('Field shrinkage')
    );
    expect(shrinkageCall).toBeUndefined();
  });
});
