import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assignUnitTestFilesToShards,
  buildUnitShardRuntimeProfile,
  collectUnitShardBalanceIssues,
  parseUnitShardRunArguments,
  readPersistedMeasuredDurations,
} from '../../../scripts/unitShardBalanceSupport.mjs';

type ShardSummary = {
  index: number;
  files: string[];
  estimatedDurationMs: number;
};

describe('unit shard balance support', () => {
  it('balances files by measured duration instead of file count', () => {
    const files = [
      'src/tests/a/heavy-a.test.ts',
      'src/tests/a/heavy-b.test.ts',
      'src/tests/b/medium-a.test.ts',
      'src/tests/b/medium-b.test.ts',
      'src/tests/c/light-a.test.ts',
      'src/tests/c/light-b.test.ts',
    ];

    const shards = assignUnitTestFilesToShards({
      files,
      shardCount: 2,
      durationByFile: {
        'src/tests/a/heavy-a.test.ts': 9000,
        'src/tests/a/heavy-b.test.ts': 8000,
        'src/tests/b/medium-a.test.ts': 5000,
        'src/tests/b/medium-b.test.ts': 4000,
        'src/tests/c/light-a.test.ts': 1000,
        'src/tests/c/light-b.test.ts': 1000,
      },
    });

    const totals = shards
      .map((shard: ShardSummary) => shard.estimatedDurationMs)
      .sort((a, b) => a - b);

    expect(shards).toHaveLength(2);
    expect(totals).toEqual([14000, 14000]);
    expect(shards.flatMap((shard: ShardSummary) => shard.files).sort()).toEqual([...files].sort());
  });

  it('detects duplicate locked files and missing critical tests', () => {
    const issues = collectUnitShardBalanceIssues({
      allFiles: [
        'src/tests/risk/clinicalSync.test.ts',
        'src/tests/risk/census.test.ts',
        'src/tests/other/covered.test.ts',
      ],
      config: {
        shardCount: 2,
        tolerancePercent: 25,
        criticalTestGlobs: ['src/tests/risk/*.test.ts'],
        lockedAssignments: {
          1: ['src/tests/risk/clinicalSync.test.ts', 'src/tests/risk/census.test.ts'],
          2: ['src/tests/risk/clinicalSync.test.ts'],
        },
      },
      assignments: [
        {
          index: 1,
          files: ['src/tests/risk/clinicalSync.test.ts', 'src/tests/other/covered.test.ts'],
          estimatedDurationMs: 1000,
        },
        {
          index: 2,
          files: ['src/tests/risk/clinicalSync.test.ts'],
          estimatedDurationMs: 1000,
        },
      ],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        'src/tests/risk/clinicalSync.test.ts is assigned to multiple unit shards.',
        'Critical unit test is not assigned to any shard: src/tests/risk/census.test.ts.',
      ])
    );
  });

  it('builds a runtime profile with slow files, functional groups and rebalance guidance', () => {
    const profile = buildUnitShardRuntimeProfile({
      files: [
        'src/tests/features/census/censusFlow.test.ts',
        'src/tests/services/storage/syncQueue.test.ts',
        'src/tests/hooks/useAuditData.test.ts',
        'src/tests/build/ciWorkflowGovernance.test.ts',
      ],
      durationByFile: {
        'src/tests/features/census/censusFlow.test.ts': 12000,
        'src/tests/services/storage/syncQueue.test.ts': 9000,
        'src/tests/hooks/useAuditData.test.ts': 4000,
        'src/tests/build/ciWorkflowGovernance.test.ts': 1000,
      },
      config: {
        shardCount: 2,
        tolerancePercent: 25,
        criticalTestGlobs: ['src/tests/features/census/*.test.ts'],
        lockedAssignments: {},
      },
    });

    expect(profile.summary.totalFiles).toBe(4);
    expect(profile.slowestFiles[0]).toMatchObject({
      file: 'src/tests/features/census/censusFlow.test.ts',
      estimatedDurationMs: 12000,
    });
    expect(profile.functionalGroups.map((group: { id: string }) => group.id)).toEqual(
      expect.arrayContaining(['census', 'storage-sync', 'audit-observability', 'governance'])
    );
    expect(profile.recommendation).toContain('unit shard');
  });

  it('adds configurable per-file overhead so wall-clock balance does not ignore file count', () => {
    const profile = buildUnitShardRuntimeProfile({
      files: ['src/tests/a/slow.test.ts', 'src/tests/b/fast.test.ts'],
      durationByFile: {
        'src/tests/a/slow.test.ts': 1000,
        'src/tests/b/fast.test.ts': 100,
      },
      config: {
        shardCount: 2,
        tolerancePercent: 200,
        perFileOverheadMs: 250,
        criticalTestGlobs: [],
        lockedAssignments: {},
      },
    });

    expect(profile.durationByFile).toMatchObject({
      'src/tests/a/slow.test.ts': 1250,
      'src/tests/b/fast.test.ts': 350,
    });
  });

  it('exposes a calibrated CI duration without changing shard assignment balance', () => {
    const profile = buildUnitShardRuntimeProfile({
      files: ['src/tests/a/slow.test.ts', 'src/tests/b/fast.test.ts'],
      durationByFile: {
        'src/tests/a/slow.test.ts': 1000,
        'src/tests/b/fast.test.ts': 1000,
      },
      config: {
        shardCount: 2,
        tolerancePercent: 25,
        ciRuntimeCalibrationFactor: 3.3,
        criticalTestGlobs: [],
        lockedAssignments: {},
      },
    });

    expect(profile.summary.totalEstimatedDurationMs).toBe(2000);
    expect(profile.summary.totalCiEstimatedDurationMs).toBe(6600);
    expect(profile.summary.ciRuntimeCalibrationFactor).toBe(3.3);
    expect(
      profile.shards.map((shard: { estimatedDurationMs: number }) => shard.estimatedDurationMs)
    ).toEqual([1000, 1000]);
    expect(
      profile.shards.map((shard: { ciEstimatedDurationMs: number }) => shard.ciEstimatedDurationMs)
    ).toEqual([3300, 3300]);
  });

  it('does not add per-file overhead twice when reusing the persisted runtime profile', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-shard-balance-'));
    fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'reports/unit-shard-runtime-profile.json'),
      JSON.stringify({
        durationByFile: {
          'src/tests/sample/example.test.ts': 1100,
        },
      })
    );

    const persistedDurations = readPersistedMeasuredDurations(root, {
      perFileOverheadMs: 100,
    });

    expect(persistedDurations['src/tests/sample/example.test.ts']).toBe(1000);
  });

  it('parses the shard argument while preserving passthrough Vitest flags', () => {
    expect(parseUnitShardRunArguments(['2/4', '--reporter=dot', '--runInBand'])).toEqual({
      requestedShard: { index: 2, count: 4 },
      passthroughArgs: ['--reporter=dot', '--runInBand'],
    });
  });
});
