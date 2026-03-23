#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'scripts', 'config', 'technical-ownership-map.json');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const REQUIRED_AREA_IDS = [
  'auth',
  'sync',
  'repositories',
  'clinical-documents',
  'census',
  'handoff',
  'backup',
];

const fail = issues => {
  console.error('[technical-ownership-map] Governance gaps found:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
};

if (!fs.existsSync(CONFIG_PATH)) {
  fail(['Missing scripts/config/technical-ownership-map.json']);
}

if (!fs.existsSync(PACKAGE_JSON_PATH)) {
  fail(['Missing package.json']);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
const areas = Array.isArray(config.areas) ? config.areas : [];
const issues = [];

if (config.version !== 1) {
  issues.push(`Expected version 1, received ${String(config.version || 'unknown')}`);
}

const ids = areas.map(area => (typeof area?.id === 'string' ? area.id.trim() : '')).filter(Boolean);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length > 0) {
  issues.push(`Duplicate area ids: ${[...new Set(duplicateIds)].join(', ')}`);
}

const missingRequiredIds = REQUIRED_AREA_IDS.filter(id => !ids.includes(id));
if (missingRequiredIds.length > 0) {
  issues.push(`Missing required ownership areas: ${missingRequiredIds.join(', ')}`);
}

for (const area of areas) {
  const id = typeof area?.id === 'string' ? area.id.trim() : 'unknown';
  const owner = typeof area?.owner === 'string' ? area.owner.trim() : '';
  const primaryMetric = typeof area?.primaryMetric === 'string' ? area.primaryMetric.trim() : '';
  const gates = Array.isArray(area?.gates)
    ? area.gates.filter(gate => typeof gate === 'string' && gate.trim()).map(gate => gate.trim())
    : [];
  const runbooks = Array.isArray(area?.runbooks)
    ? area.runbooks
        .filter(runbook => typeof runbook === 'string' && runbook.trim())
        .map(runbook => runbook.trim())
    : [];

  if (!owner) {
    issues.push(`${id}: missing owner`);
  }

  if (!primaryMetric) {
    issues.push(`${id}: missing primaryMetric`);
  }

  if (gates.length === 0) {
    issues.push(`${id}: must declare at least one gate`);
  }

  if (runbooks.length === 0) {
    issues.push(`${id}: must declare at least one runbook`);
  }

  for (const gate of gates) {
    if (typeof packageJson.scripts?.[gate] !== 'string') {
      issues.push(`${id}: unknown gate script ${gate}`);
    }
  }

  for (const runbook of runbooks) {
    const absoluteRunbookPath = path.join(ROOT, runbook);
    if (!fs.existsSync(absoluteRunbookPath)) {
      issues.push(`${id}: missing runbook ${runbook}`);
    }
  }
}

if (issues.length > 0) {
  fail(issues);
}

console.log(`[technical-ownership-map] OK (${areas.length} areas)`);
