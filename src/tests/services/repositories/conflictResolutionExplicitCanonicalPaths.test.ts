import { describe, expect, it } from 'vitest';
import { resolveDailyRecordConflict } from '@/services/repositories/conflictResolutionMatrix';
import type { DailyRecord } from '@/types/domain/dailyRecord';

const makeRecord = (date: string, lastUpdated: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated,
  nurses: [],
  activeExtraBeds: [],
});

describe('conflictResolution explicit canonical paths', () => {
  it('does not let stale explicit local paths overwrite newer remote canonical census fields', () => {
    const remote = makeRecord('2026-02-18', '2026-02-18T10:05:00.000Z');
    remote.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Nombre remoto vigente',
        pathology: 'Diagnostico remoto vigente',
      } as unknown as DailyRecord['beds'][string],
    };

    const local = makeRecord('2026-02-18', '2026-02-18T10:00:00.000Z');
    local.beds = {
      R1: {
        bedId: 'R1',
        patientName: 'Nombre local stale',
        pathology: 'Diagnostico local stale',
      } as unknown as DailyRecord['beds'][string],
    };

    const resolved = resolveDailyRecordConflict(remote, local, {
      changedPaths: ['beds.R1.patientName', 'beds.R1.pathology'],
    });

    expect(resolved.beds.R1.patientName).toBe('Nombre remoto vigente');
    expect(resolved.beds.R1.pathology).toBe('Diagnostico remoto vigente');
  });
});
