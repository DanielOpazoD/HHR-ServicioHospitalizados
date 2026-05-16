import { afterEach, describe, expect, it } from 'vitest';
import { DataFactory } from '@/tests/factories/DataFactory';
import { PatientStatus } from '@/types/domain/patientClassification';
import {
  applyPendingExplicitCensusPatch,
  clearPendingDailyRecordPatchesForTests,
  registerPendingDailyRecordPatch,
  releaseConfirmedPendingDailyRecordPatches,
} from '@/hooks/controllers/dailyRecordPendingPatchController';

describe('dailyRecordPendingPatchController', () => {
  afterEach(() => {
    clearPendingDailyRecordPatchesForTests();
  });

  it('keeps a pending clinical status patch while the remote snapshot has not confirmed it', () => {
    const previousRecord = DataFactory.createMockDailyRecord('2025-01-08');
    previousRecord.beds.R1.clinicalEpisodeId = undefined;
    previousRecord.beds.R1.rut = '11.111.111-1';
    previousRecord.beds.R1.admissionDate = '2025-01-08';
    previousRecord.beds.R1.admissionTime = '08:00';
    previousRecord.beds.R1.status = PatientStatus.GRAVE;

    const incomingRecord = DataFactory.createMockDailyRecord('2025-01-08');
    incomingRecord.beds.R1.clinicalEpisodeId = 'ep-r1-from-firestore';
    incomingRecord.beds.R1.rut = '11.111.111-1';
    incomingRecord.beds.R1.admissionDate = '2025-01-08';
    incomingRecord.beds.R1.admissionTime = '08:00';
    incomingRecord.beds.R1.status = PatientStatus.EMPTY;

    registerPendingDailyRecordPatch('2025-01-08', {
      'beds.R1.status': PatientStatus.GRAVE,
    });

    releaseConfirmedPendingDailyRecordPatches('2025-01-08', incomingRecord, previousRecord);
    const resolved = applyPendingExplicitCensusPatch('2025-01-08', incomingRecord, previousRecord);

    expect(resolved.beds.R1.status).toBe(PatientStatus.GRAVE);
  });

  it('releases a pending clinical status patch once the remote snapshot confirms the value', () => {
    const previousRecord = DataFactory.createMockDailyRecord('2025-01-08');
    previousRecord.beds.R1.clinicalEpisodeId = undefined;
    previousRecord.beds.R1.rut = '11.111.111-1';
    previousRecord.beds.R1.admissionDate = '2025-01-08';
    previousRecord.beds.R1.admissionTime = '08:00';
    previousRecord.beds.R1.status = PatientStatus.GRAVE;

    const confirmedRecord = DataFactory.createMockDailyRecord('2025-01-08');
    confirmedRecord.beds.R1.clinicalEpisodeId = 'ep-r1-from-firestore';
    confirmedRecord.beds.R1.rut = '11.111.111-1';
    confirmedRecord.beds.R1.admissionDate = '2025-01-08';
    confirmedRecord.beds.R1.admissionTime = '08:00';
    confirmedRecord.beds.R1.status = PatientStatus.GRAVE;

    const laterIncomingRecord = {
      ...confirmedRecord,
      beds: {
        ...confirmedRecord.beds,
        R1: {
          ...confirmedRecord.beds.R1,
          status: PatientStatus.EMPTY,
        },
      },
    };

    registerPendingDailyRecordPatch('2025-01-08', {
      'beds.R1.status': PatientStatus.GRAVE,
    });

    releaseConfirmedPendingDailyRecordPatches('2025-01-08', confirmedRecord, previousRecord);
    const resolved = applyPendingExplicitCensusPatch(
      '2025-01-08',
      laterIncomingRecord,
      confirmedRecord
    );

    expect(resolved.beds.R1.status).toBe(PatientStatus.EMPTY);
  });
});
