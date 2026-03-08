#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const ALLOWLIST = [
  'src/schemas/',
  'src/services/repositories/dataMigration.ts',
  'src/services/repositories/dailyRecordAggregate.ts',
  'src/services/storage/firestore/firestoreShared.ts',
  'src/services/staff/dailyRecordStaffing.ts',
  'src/tests/',
  'src/types/domain/dailyRecord.ts',
];

const LEGACY_PATTERNS = [
  { label: '.nurses', regex: /\.[ \t]*nurses\b(?![A-Z])/g },
  { label: '.nurseName', regex: /\.[ \t]*nurseName\b/g },
];

const toPosix = value => value.split(path.sep).join('/');

const isSourceFile = filePath => {
  const extension = path.extname(filePath);
  if (!SOURCE_EXTENSIONS.has(extension)) return false;
  if (filePath.endsWith('.d.ts')) return false;
  return true;
};

const walkFiles = dirPath => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && isSourceFile(absolutePath)) {
      files.push(absolutePath);
    }
  }

  return files;
};

const files = walkFiles(SRC_ROOT);
const violations = [];

for (const absolutePath of files) {
  const relativePath = toPosix(path.relative(ROOT, absolutePath));
  if (ALLOWLIST.some(prefix => relativePath.startsWith(prefix))) {
    continue;
  }

  const source = fs.readFileSync(absolutePath, 'utf8');
  for (const pattern of LEGACY_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(source)) {
      violations.push({ file: relativePath, pattern: pattern.label });
    }
  }
}

if (violations.length === 0) {
  console.log('Legacy staff boundary checks passed.');
  process.exit(0);
}

console.error('\nLegacy staff boundary violations:');
for (const violation of violations) {
  console.error(`- ${violation.file} -> ${violation.pattern}`);
}

process.exit(1);
