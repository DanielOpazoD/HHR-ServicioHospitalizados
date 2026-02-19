#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGETS = [
  'src/services/storage',
  'src/services/repositories',
  'src/services/admin',
];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const ANY_PATTERN = /:\s*any\b|\bas\s+any\b|<\s*any\s*>/g;

const toPosix = value => value.split(path.sep).join('/');

const isSourceFile = filePath => {
  if (!SOURCE_EXTENSIONS.has(path.extname(filePath))) return false;
  if (filePath.endsWith('.d.ts')) return false;
  const normalized = toPosix(filePath);
  return !normalized.includes('/tests/') && !normalized.includes('.test.');
};

const walkFiles = dirPath => {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && isSourceFile(absolutePath)) {
      result.push(absolutePath);
    }
  }

  return result;
};

const violations = [];

for (const target of TARGETS) {
  const absoluteTarget = path.join(ROOT, target);
  const files = walkFiles(absoluteTarget);
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.match(ANY_PATTERN);
    if (matches && matches.length > 0) {
      violations.push({
        file: toPosix(path.relative(ROOT, filePath)),
        count: matches.length,
      });
    }
  }
}

if (violations.length > 0) {
  console.error('\nCritical any checks failed (must be 0 in critical modules):');
  for (const violation of violations.sort((a, b) => b.count - a.count)) {
    console.error(`- ${violation.file}: ${violation.count}`);
  }
  process.exit(1);
}

console.log('Critical any checks passed.');
