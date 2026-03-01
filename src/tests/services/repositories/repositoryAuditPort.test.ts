import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  logRepositoryConflictAutoMerged,
  setRepositoryConflictLogger,
} from '@/services/repositories/ports/repositoryAuditPort';

describe('repositoryAuditPort', () => {
  beforeEach(() => {
    setRepositoryConflictLogger(null);
  });

  it('uses injected logger when available', async () => {
    const logger = vi.fn().mockResolvedValue(undefined);
    setRepositoryConflictLogger(logger);

    await logRepositoryConflictAutoMerged('2026-02-19', {
      changedPaths: ['*'],
      policyVersion: '2026-02-v2',
      entryCount: 1,
      strategyBreakdown: { scalar_policy: 1 },
      winnerBreakdown: { local: 1 },
      reasonBreakdown: { default_local_priority: 1 },
      samplePaths: ['beds.R1.pathology'],
      assessment: {
        riskLevel: 'low',
        reviewRecommended: false,
        reviewReasons: [],
        localDominantPaths: ['beds.R1.pathology'],
        remoteProtectedPaths: [],
      },
    });

    expect(logger).toHaveBeenCalledTimes(1);
  });
});
