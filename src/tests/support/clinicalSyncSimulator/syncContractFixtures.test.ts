import { describe, expect, it } from 'vitest';
import {
  createClinicalSyncFullSaveContract,
  createClinicalSyncPathologyContract,
  expectClinicalSyncPathologyContract,
} from '@/tests/support/clinicalSyncSimulator/syncContractFixtures';

describe('syncContractFixtures', () => {
  it('builds a reusable pathology patch contract for stale-client scenarios', () => {
    expect(
      createClinicalSyncPathologyContract({
        version: '2026-05-13T10:00:00.000Z',
        revision: 7,
        mutationId: 'mutation-1',
      })
    ).toEqual({
      expectedVersion: '2026-05-13T10:00:00.000Z',
      baseRevision: 7,
      changedPaths: ['beds.R1.pathology'],
      mutationId: 'mutation-1',
    });
  });

  it('builds a reusable full-save contract without duplicating sync metadata shape', () => {
    expect(
      createClinicalSyncFullSaveContract({
        version: '2026-05-13T10:00:00.000Z',
        revision: 8,
        mutationId: 'mutation-save',
      })
    ).toEqual({
      expectedVersion: '2026-05-13T10:00:00.000Z',
      baseRevision: 8,
      changedPaths: ['*'],
      mutationId: 'mutation-save',
    });
  });

  it('asserts pathology replay contracts with the same clinical intent', () => {
    expectClinicalSyncPathologyContract({
      value: {
        expectedVersion: '2026-05-13T10:00:00.000Z',
        recordRevision: '2026-05-13T10:30:00.000Z',
        changedPaths: ['beds.R1.pathology'],
      },
      version: '2026-05-13T10:00:00.000Z',
      recordRevision: '2026-05-13T10:30:00.000Z',
    });
  });
});
