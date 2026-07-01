import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = path.join(process.cwd(), 'scripts/check-report-freshness.mjs');
const tempRoots: string[] = [];

const trackedReports = [
  'reports/quality-metrics.json',
  'reports/system-confidence.json',
  'reports/operational-health.json',
  'reports/clinical-release-validation.json',
  'reports/clinical-release-signoff.json',
  'reports/release-confidence-matrix.json',
  'reports/release-readiness-scorecard.json',
  'reports/maintenance-debt-scorecard.json',
];

const run = (root: string, command: string, args: string[] = []) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const write = (root: string, file: string, content: string) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
};

const makeGitRepoWithMergeCommit = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'report-freshness-'));
  tempRoots.push(root);

  run(root, 'git', ['init', '-b', 'main']);
  run(root, 'git', ['config', 'user.email', 'test@example.com']);
  run(root, 'git', ['config', 'user.name', 'Test User']);

  write(root, '.gitignore', 'reports/\n');
  write(root, 'README.md', '# report freshness fixture\n');
  run(root, 'git', ['add', '.gitignore', 'README.md']);
  run(root, 'git', ['commit', '-m', 'initial commit']);

  run(root, 'git', ['switch', '-c', 'feature']);
  write(root, 'feature.txt', 'feature evidence source\n');
  run(root, 'git', ['add', 'feature.txt']);
  run(root, 'git', ['commit', '-m', 'feature commit']);
  const featureSha = run(root, 'git', ['rev-parse', '--short', 'HEAD']);

  run(root, 'git', ['switch', 'main']);
  write(root, 'main.txt', 'main side change\n');
  run(root, 'git', ['add', 'main.txt']);
  run(root, 'git', ['commit', '-m', 'main commit']);
  run(root, 'git', ['merge', '--no-ff', 'feature', '-m', 'merge feature']);

  return { root, featureSha };
};

const makeGitRepoWithLinearCommit = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'report-freshness-'));
  tempRoots.push(root);

  run(root, 'git', ['init', '-b', 'main']);
  run(root, 'git', ['config', 'user.email', 'test@example.com']);
  run(root, 'git', ['config', 'user.name', 'Test User']);

  write(root, '.gitignore', 'reports/\n');
  write(root, 'README.md', '# report freshness fixture\n');
  run(root, 'git', ['add', '.gitignore', 'README.md']);
  run(root, 'git', ['commit', '-m', 'initial commit']);
  const previousSha = run(root, 'git', ['rev-parse', '--short', 'HEAD']);

  write(root, 'main.txt', 'linear change\n');
  run(root, 'git', ['add', 'main.txt']);
  run(root, 'git', ['commit', '-m', 'linear commit']);

  return { root, previousSha };
};

const writeReports = (root: string, gitSha: string) => {
  for (const report of trackedReports) {
    write(root, report, `${JSON.stringify({ gitSha, gitDirty: false }, null, 2)}\n`);
  }
  const generatedAt = new Date('2026-05-10T12:00:00.000Z');
  for (const report of trackedReports) {
    fs.utimesSync(path.join(root, report), generatedAt, generatedAt);
  }
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('report freshness guardrail', () => {
  it('accepts reports generated for a direct merge parent', () => {
    const { root, featureSha } = makeGitRepoWithMergeCommit();
    writeReports(root, featureSha);

    expect(() => run(root, 'node', [scriptPath])).not.toThrow();
  });

  it('rejects direct merge-parent reports without dependency fingerprint in strict release mode', () => {
    const { root, featureSha } = makeGitRepoWithMergeCommit();
    writeReports(root, featureSha);

    expect(() => run(root, 'node', [scriptPath, '--strict'])).toThrow(
      /reports\/quality-metrics\.json was generated for direct merge parent .* without dependency fingerprint/
    );
  });

  it('treats stale reports as advisory outside strict release mode', () => {
    const { root } = makeGitRepoWithMergeCommit();
    const staleSha = run(root, 'git', ['rev-parse', '--short', 'HEAD^1^']);
    writeReports(root, staleSha);

    expect(() => run(root, 'node', [scriptPath])).not.toThrow();
  });

  it('rejects reports generated for an older merge ancestor in strict release mode', () => {
    const { root } = makeGitRepoWithMergeCommit();
    const staleSha = run(root, 'git', ['rev-parse', '--short', 'HEAD^1^']);
    writeReports(root, staleSha);

    expect(() => run(root, 'node', [scriptPath, '--strict'])).toThrow(
      /reports\/quality-metrics\.json is stale by commit ancestry/
    );
  });

  it('rejects parent reports for a non-merge commit in strict release mode', () => {
    const { root, previousSha } = makeGitRepoWithLinearCommit();
    writeReports(root, previousSha);

    expect(() => run(root, 'node', [scriptPath, '--strict'])).toThrow(
      /reports\/quality-metrics\.json is stale by commit ancestry/
    );
  });

  it('accepts parent reports when HEAD only commits governed evidence artifacts', () => {
    const { root } = makeGitRepoWithLinearCommit();
    const parentSha = run(root, 'git', ['rev-parse', '--short', 'HEAD']);
    writeReports(root, parentSha);
    run(root, 'git', ['add', '-f', 'reports']);
    run(root, 'git', ['commit', '-m', 'refresh evidence reports']);

    expect(() => run(root, 'node', [scriptPath, '--strict'])).not.toThrow();
  });
});
