#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const GOVERNANCE_CONFIG_PATH = path.join(ROOT, 'scripts/config/guardrail-governance.json');

if (!fs.existsSync(GOVERNANCE_CONFIG_PATH)) {
  console.error('[quality] Missing scripts/config/guardrail-governance.json');
  process.exit(1);
}

const governanceConfig = JSON.parse(fs.readFileSync(GOVERNANCE_CONFIG_PATH, 'utf8'));
const QUALITY_STEPS = Array.isArray(governanceConfig.qualityAggregate?.checks)
  ? governanceConfig.qualityAggregate.checks.filter(entry => entry?.id)
  : [];

if (QUALITY_STEPS.length === 0) {
  console.error('[quality] qualityAggregate.checks is empty in guardrail-governance.json');
  process.exit(1);
}

const failures = [];
const advisoryFailures = [];

for (const entry of QUALITY_STEPS) {
  const step = entry.id;
  const isReportOnly = entry.reportOnly === true;
  const label = isReportOnly ? `${step} (advisory)` : step;
  console.log(`\n[quality] Running ${label}`);
  const result = spawnSync('npm', ['run', step], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    if (isReportOnly) {
      advisoryFailures.push(step);
    } else {
      failures.push(step);
    }
  }
}

if (advisoryFailures.length > 0) {
  console.warn('\n[quality] Advisory (non-blocking) steps reporting issues:');
  for (const step of advisoryFailures) {
    console.warn(`- ${step}`);
  }
}

if (failures.length > 0) {
  console.error('\n[quality] Failing steps:');
  for (const step of failures) {
    console.error(`- ${step}`);
  }
  process.exit(1);
}

console.log(
  advisoryFailures.length > 0
    ? '\n[quality] All blocking checks passed (with advisories above).'
    : '\n[quality] All checks passed.'
);
