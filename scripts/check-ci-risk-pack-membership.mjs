#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'scripts/config/ci-test-risk-packs.json');

const fail = message => {
  console.error(`[ci-risk-pack-membership] ${message}`);
  process.exit(1);
};

if (!fs.existsSync(CONFIG_PATH)) {
  fail('Missing scripts/config/ci-test-risk-packs.json');
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const criticalFiles = Array.isArray(config.criticalFiles) ? config.criticalFiles : [];
const excludedPrefixes = Array.isArray(config.excludedFromUnitSuite)
  ? config.excludedFromUnitSuite
  : [];

if (criticalFiles.length === 0) {
  fail('criticalFiles is empty');
}

const missingFiles = criticalFiles.filter(file => !fs.existsSync(path.join(ROOT, file)));
if (missingFiles.length > 0) {
  fail(`Critical risk files do not exist:\n${missingFiles.map(file => `- ${file}`).join('\n')}`);
}

const excludedCriticalFiles = criticalFiles.filter(file =>
  excludedPrefixes.some(prefix => file === prefix || file.startsWith(prefix))
);
if (excludedCriticalFiles.length > 0) {
  fail(
    `Critical risk files are excluded from test:ci:unit:\n${excludedCriticalFiles
      .map(file => `- ${file}`)
      .join('\n')}`
  );
}

console.log(`[ci-risk-pack-membership] OK (${criticalFiles.length} critical files covered)`);
