import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildAuditAttemptEnv,
  classifyAuditFailure,
  shouldRetryAuditWithSystemCa,
} from '../../../scripts/lib/dependencyAuditSupport.mjs';

describe('dependency audit support', () => {
  it('classifies npm audit certificate trust failures distinctly', () => {
    expect(
      classifyAuditFailure({
        stdout: '',
        stderr:
          'request to https://registry.npmjs.org/-/npm/v1/security/advisories/bulk failed, reason: unable to verify the first certificate',
      })
    ).toBe('certificate_untrusted');
  });

  it('retries certificate failures with the system CA option exactly once', () => {
    expect(
      shouldRetryAuditWithSystemCa({
        failureCategory: 'certificate_untrusted',
        nodeOptions: '',
      })
    ).toBe(true);

    const retryEnv = buildAuditAttemptEnv({ NODE_OPTIONS: '--trace-warnings' }) as {
      NODE_OPTIONS?: string;
    };
    expect(retryEnv.NODE_OPTIONS).toBe('--trace-warnings --use-system-ca');

    expect(
      shouldRetryAuditWithSystemCa({
        failureCategory: 'certificate_untrusted',
        nodeOptions: '--use-system-ca',
      })
    ).toBe(false);
  });

  it('lets the dependency audit script recover from a certificate-only npm audit failure', () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-audit-'));
    const fakeBinDir = path.join(fixtureDir, 'bin');
    const functionsDir = path.join(fixtureDir, 'functions');
    fs.mkdirSync(fakeBinDir);
    fs.mkdirSync(functionsDir);

    const manifest = JSON.stringify({ name: 'audit-fixture', version: '1.0.0' });
    const lockfile = JSON.stringify({ name: 'audit-fixture', lockfileVersion: 3, packages: {} });
    fs.writeFileSync(path.join(fixtureDir, 'package.json'), manifest);
    fs.writeFileSync(path.join(fixtureDir, 'package-lock.json'), lockfile);
    fs.writeFileSync(path.join(functionsDir, 'package.json'), manifest);
    fs.writeFileSync(path.join(functionsDir, 'package-lock.json'), lockfile);

    const fakeNpmPath = path.join(fakeBinDir, 'npm');
    fs.writeFileSync(
      fakeNpmPath,
      [
        '#!/bin/sh',
        'if printf "%s" "$NODE_OPTIONS" | grep -q -- "--use-system-ca"; then',
        '  printf \'{"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}},"vulnerabilities":{}}\\n\'',
        '  exit 0',
        'fi',
        'echo "request to https://registry.npmjs.org/-/npm/v1/security/advisories/bulk failed, reason: unable to verify the first certificate" >&2',
        'exit 1',
        '',
      ].join('\n')
    );
    fs.chmodSync(fakeNpmPath, 0o755);

    const scriptPath = path.join(process.cwd(), 'scripts/check-dependency-vulnerabilities.mjs');
    execFileSync(process.execPath, [scriptPath], {
      cwd: fixtureDir,
      env: {
        ...process.env,
        PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH || ''}`,
        NODE_OPTIONS: '',
      },
      encoding: 'utf8',
    });

    const report = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, 'reports/security/dependency-audit.json'), 'utf8')
    );

    expect(report.overallStatus).toBe('ok');
    expect(report.workspaces).toHaveLength(2);
    expect(
      report.workspaces.every(
        (workspace: { retriedWithSystemCa: boolean }) => workspace.retriedWithSystemCa
      )
    ).toBe(true);
  });
});
