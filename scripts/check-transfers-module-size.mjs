#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'scripts', 'transfers-module-size-limits.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const violations = [];

for (const [relativePath, maxLines] of Object.entries(config.files)) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    violations.push(`${relativePath}: file missing`);
    continue;
  }
  const lineCount = fs.readFileSync(absolutePath, 'utf8').split('\n').length;
  if (lineCount > maxLines) {
    violations.push(`${relativePath}: ${lineCount} lines (limit ${maxLines})`);
  }
}

if (violations.length > 0) {
  console.error('\nTransfers module size violations:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Transfers module size checks passed.');
