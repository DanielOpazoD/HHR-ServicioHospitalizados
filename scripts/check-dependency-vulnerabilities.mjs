#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportsDir = path.join(root, 'reports', 'security');
const outputPath = path.join(reportsDir, 'dependency-audit.json');

fs.mkdirSync(reportsDir, { recursive: true });

const result = spawnSync('npm', ['audit', '--omit=dev', '--audit-level=high', '--json'], {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

const stdout = result.stdout || '';
const stderr = result.stderr || '';
const combinedOutput = `${stdout}\n${stderr}`.trim();

let parsedReport = null;
if (stdout.trim()) {
  try {
    parsedReport = JSON.parse(stdout);
  } catch {
    parsedReport = {
      parseError: 'npm audit did not return valid JSON',
      rawOutput: stdout,
    };
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  command: 'npm audit --omit=dev --audit-level=high --json',
  exitCode: result.status,
  report: parsedReport,
  stderr: stderr || undefined,
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (result.status !== 0) {
  console.error('[dependency-vulnerabilities] Production dependency audit failed.');
  if (combinedOutput) {
    console.error(combinedOutput);
  }
  process.exit(result.status || 1);
}

console.log('[dependency-vulnerabilities] OK');
console.log(`[dependency-vulnerabilities] Report generated at ${path.relative(root, outputPath)}`);
