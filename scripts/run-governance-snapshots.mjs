#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const steps = [
  'report:release-readiness-scorecard',
  'report:runtime-contracts',
  'report:serverless-runtime-governance',
  'report:serverless-sensitive-coverage',
  'report:sustainable-change-policy',
  'report:maintenance-debt-scorecard',
];

for (const step of steps) {
  console.log(`::group::${step}`);
  const startedAt = Date.now();
  const result = spawnSync('npm', ['run', step], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`::endgroup::`);
  console.log(`[governance-snapshots] ${step} finished in ${elapsedSeconds}s`);

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

