#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const QUALITY_STEPS = [
  'check:architecture',
  'check:application-port-boundary',
  'check:legacy-staff-boundary',
  'check:core-test-boundary',
  'check:core-trivial-tests',
  'check:core-console-usage',
  'check:auth-feature-boundary',
  'check:clinical-documents-feature-boundary',
  'check:feature-dependencies',
  'check:shared-layer-boundary',
  'check:barrel-boundaries',
  'check:handoff-context-boundaries',
  'check:storage-context-boundaries',
  'check:core-type-facade-boundaries',
  'check:root-domain-barrels',
  'check:persistence-hub-boundaries',
  'check:legacy-localstorage-imports',
  'check:legacy-bridge-boundary',
  'check:schema-governance',
  'check:runtime-contracts',
  'check:docs-drift',
  'check:operational-runbooks',
  'check:folder-dependencies',
  'check:module-dependencies',
  'check:module-size',
  'check:handoff-module-size',
  'check:census-module-size',
  'check:transfers-module-size',
  'check:hook-hotspots',
  'check:hotspot-growth',
  'check:census-runtime-boundary',
  'check:runtime-adapter-boundary',
  'check:test-governance',
  'check:test-failure-catalog',
  'check:flaky-quarantine',
  'check:critical-any',
  'check:source-any',
  'check:repo-hygiene',
  'check:security',
];

const failures = [];

for (const step of QUALITY_STEPS) {
  console.log(`\n[quality] Running ${step}`);
  const result = spawnSync('npm', ['run', step], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    failures.push(step);
  }
}

if (failures.length > 0) {
  console.error('\n[quality] Failing steps:');
  for (const step of failures) {
    console.error(`- ${step}`);
  }
  process.exit(1);
}

console.log('\n[quality] All checks passed.');
