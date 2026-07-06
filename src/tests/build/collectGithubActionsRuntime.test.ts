import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildGithubActionsJobsUrl,
  collectGithubActionsRuntimeInput,
  normalizeGithubActionsJob,
} from '../../../scripts/collect-github-actions-runtime.mjs';

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ci-runtime-${randomUUID()}-`));
  tempDirs.push(dir);
  return dir;
};

const makeResponse = (body: unknown, ok = true) =>
  ({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Server Error',
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('collect GitHub Actions runtime', () => {
  it('normalizes GitHub Actions jobs into the observed runtime input contract', () => {
    expect(
      normalizeGithubActionsJob({
        name: 'unit-risk-shard-1',
        status: 'completed',
        conclusion: 'success',
        started_at: '2026-07-06T01:43:33Z',
        completed_at: '2026-07-06T01:47:27Z',
      })
    ).toEqual({
      name: 'unit-risk-shard-1',
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
      startedAt: '2026-07-06T01:43:33Z',
      completedAt: '2026-07-06T01:47:27Z',
    });
  });

  it('builds the GitHub jobs endpoint from repository and run id', () => {
    expect(
      buildGithubActionsJobsUrl({
        apiUrl: 'https://api.github.com',
        repository: 'DanielOpazoD/HHR-ServicioHospitalizados',
        runId: '28767128242',
        page: 2,
        perPage: 100,
      })
    ).toBe(
      'https://api.github.com/repos/DanielOpazoD/HHR-ServicioHospitalizados/actions/runs/28767128242/jobs?per_page=100&page=2'
    );
  });

  it('collects paginated jobs and writes ci-runtime-observed-input.json', async () => {
    const root = makeTempDir();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse({
          jobs: [
            {
              name: 'unit-risk-shard-1',
              status: 'completed',
              conclusion: 'success',
              started_at: '2026-07-06T01:43:33Z',
              completed_at: '2026-07-06T01:47:27Z',
            },
          ],
        })
      )
      .mockResolvedValueOnce(makeResponse({ jobs: [] }));

    const result = await collectGithubActionsRuntimeInput({
      env: {
        GITHUB_TOKEN: 'ghs_test',
        GITHUB_REPOSITORY: 'DanielOpazoD/HHR-ServicioHospitalizados',
        GITHUB_RUN_ID: '28767128242',
      },
      fetchImpl,
      root,
    });

    const outputPath = path.join(root, 'reports/ci-runtime-observed-input.json');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.jobs).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf8'))).toMatchObject({
      source: {
        provider: 'github-actions',
        repository: 'DanielOpazoD/HHR-ServicioHospitalizados',
        runId: '28767128242',
        status: 'collected',
      },
      jobs: [
        {
          name: 'unit-risk-shard-1',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
        },
      ],
    });
  });

  it('writes advisory empty input when local configuration is missing', async () => {
    const root = makeTempDir();

    const result = await collectGithubActionsRuntimeInput({
      env: {},
      fetchImpl: vi.fn(),
      root,
      required: false,
    });

    expect(result.jobs).toEqual([]);
    expect(result.source.status).toBe('missing_configuration');
    expect(
      JSON.parse(fs.readFileSync(path.join(root, 'reports/ci-runtime-observed-input.json'), 'utf8'))
    ).toMatchObject({
      jobs: [],
      source: {
        status: 'missing_configuration',
      },
    });
  });

  it('fails with actionable missing configuration when collection is required', async () => {
    await expect(
      collectGithubActionsRuntimeInput({
        env: { GITHUB_REPOSITORY: 'DanielOpazoD/HHR-ServicioHospitalizados' },
        fetchImpl: vi.fn(),
        root: makeTempDir(),
        required: true,
      })
    ).rejects.toThrow(/Missing GitHub Actions runtime configuration: GITHUB_TOKEN, GITHUB_RUN_ID/);
  });

  it('fails with actionable API errors', async () => {
    await expect(
      collectGithubActionsRuntimeInput({
        env: {
          GITHUB_TOKEN: 'ghs_test',
          GITHUB_REPOSITORY: 'DanielOpazoD/HHR-ServicioHospitalizados',
          GITHUB_RUN_ID: '28767128242',
        },
        fetchImpl: vi.fn().mockResolvedValue(makeResponse({ message: 'bad' }, false)),
        root: makeTempDir(),
      })
    ).rejects.toThrow(/GitHub Actions jobs request failed: 500 Server Error/);
  });
});
