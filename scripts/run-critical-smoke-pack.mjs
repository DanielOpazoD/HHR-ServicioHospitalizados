#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = process.cwd();
const configPath = path.join(workspaceRoot, 'scripts/config/critical-smoke-pack.json');

if (!fs.existsSync(configPath)) {
  console.error('[critical-smoke-pack] Missing scripts/config/critical-smoke-pack.json');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const scenarios = Array.isArray(config.scenarios) ? config.scenarios : [];
const files = [...new Set(scenarios.map(scenario => scenario.file).filter(Boolean))];

if (files.length === 0) {
  console.error('[critical-smoke-pack] No smoke scenarios configured');
  process.exit(1);
}

console.log('[critical-smoke-pack] Running scenarios:');
for (const scenario of scenarios) {
  console.log(`- ${scenario.id}: ${scenario.label} -> ${scenario.file}`);
}

for (const file of files) {
  const result = spawnSync('npx', ['vitest', 'run', file], {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('[critical-smoke-pack] All scenarios passed.');
