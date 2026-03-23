#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = process.cwd();
const configPath = path.join(workspaceRoot, 'scripts/config/release-confidence-pack.json');

if (!fs.existsSync(configPath)) {
  console.error('[release-confidence-pack] Missing scripts/config/release-confidence-pack.json');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const steps = Array.isArray(config.steps) ? config.steps : [];

if (steps.length === 0) {
  console.error('[release-confidence-pack] No steps configured');
  process.exit(1);
}

console.log('[release-confidence-pack] Running steps:');
for (const step of steps) {
  console.log(`- ${step.id}: ${step.label} -> ${step.command}`);
}

for (const step of steps) {
  const command = String(step.command || '').trim();
  if (!command) {
    console.error(`[release-confidence-pack] Step ${step.id} is missing a command`);
    process.exit(1);
  }

  console.log(`\n[release-confidence-pack] ${step.id}`);
  const result = spawnSync(command, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\n[release-confidence-pack] All steps passed.');
