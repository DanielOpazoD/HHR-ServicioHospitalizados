import { describe, expect, it } from 'vitest';
import {
  resolveDailyRecordSyncOwnership,
  SYNC_OWNERSHIP_POLICY_VERSION,
} from '@/services/repositories/dailyRecordSyncOwnershipPolicy';

describe('dailyRecordSyncOwnershipPolicy', () => {
  it('classifies patient fields through a central ownership matrix', () => {
    expect(SYNC_OWNERSHIP_POLICY_VERSION).toBe('2026-05-daily-record-v1');
    expect(resolveDailyRecordSyncOwnership('beds.R1.patientName')).toBe('remoteCanonical');
    expect(resolveDailyRecordSyncOwnership('beds.R1.rut')).toBe('remoteCanonical');
    expect(resolveDailyRecordSyncOwnership('beds.R1.pathology')).toBe('remoteCanonical');
    expect(resolveDailyRecordSyncOwnership('beds.R1.specialty')).toBe('remoteCanonical');
    expect(resolveDailyRecordSyncOwnership('beds.R1.status')).toBe('remoteCanonical');
    expect(resolveDailyRecordSyncOwnership('beds.R1.upcChecklist')).toBe('remoteCanonical');
    expect(resolveDailyRecordSyncOwnership('beds.R1.bedMode')).toBe('adminRemote');
    expect(resolveDailyRecordSyncOwnership('beds.R1.location')).toBe('adminRemote');
    expect(resolveDailyRecordSyncOwnership('beds.R1.clinicalCrib')).toBe('movementInvariant');
    expect(resolveDailyRecordSyncOwnership('beds.R1.handoffNote')).toBe('localNarrative');
    expect(resolveDailyRecordSyncOwnership('beds.R1.medicalHandoffNote')).toBe('localNarrative');
    expect(resolveDailyRecordSyncOwnership('discharges')).toBe('mergeById');
    expect(resolveDailyRecordSyncOwnership('transfers')).toBe('mergeById');
    expect(resolveDailyRecordSyncOwnership('beds.R1.unknown')).toBe('default');
  });
});
