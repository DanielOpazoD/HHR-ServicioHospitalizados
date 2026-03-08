#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_FILES = [
  'src/tests/types/core.test.ts',
  'src/tests/schemas/zodSchemas.test.ts',
  'src/tests/services/featureFlags.test.ts',
];

const TRIVIAL_PATTERNS = [
  /expect\(\s*BedType\.[A-Z_]+\s*\)\.toBe\(\s*['"][A-Z_]+['"]\s*\)/g,
  /expect\(\s*PatientStatus\.[A-Z_]+\s*\)\.toBe\(\s*['"][^'"]+['"]\s*\)/g,
  /expect\(\s*Specialty\.[A-Z_]+\s*\)\.toBe\(\s*['"][^'"]+['"]\s*\)/g,
  /expect\(\s*BedTypeSchema\.parse\(\s*['"][A-Z_]+['"]\s*\)\s*\)\.toBe\(\s*['"][A-Z_]+['"]\s*\)/g,
  /expect\(\s*typeof\s+[A-Za-z0-9_.()]+\s*\)\.toBe\(\s*['"](function|object|boolean)['"]\s*\)/g,
];

const violations = [];

for (const relativePath of TARGET_FILES) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const source = fs.readFileSync(absolutePath, 'utf8');

  for (const pattern of TRIVIAL_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = source.match(pattern);
    if (matches?.length) {
      violations.push({
        file: relativePath,
        count: matches.length,
      });
    }
  }
}

if (violations.length === 0) {
  console.log('Core trivial test checks passed.');
  process.exit(0);
}

console.error('\nCore trivial test violations:');
for (const violation of violations) {
  console.error(`- ${violation.file}: ${violation.count} trivial enum/constant assertions detected`);
}

process.exit(1);
