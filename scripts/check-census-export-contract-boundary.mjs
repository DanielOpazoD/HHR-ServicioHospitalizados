#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_PATHS = [
  'src/contracts/serverless.ts',
  'src/services/exporters/censusMasterWorkbook.ts',
  'src/services/exporters/censusMasterExport.ts',
  'src/services/exporters/excel',
  'src/services/integrations/censusEmailRequestPayload.ts',
  'src/services/integrations/censusEmailService.ts',
].map(relativePath => path.join(ROOT, relativePath));
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const RESTRICTED_IMPORT = '@/services/contracts/dailyRecordServiceContracts';
const ALLOWED_IMPORTERS = new Set(['src/services/contracts/censusExportServiceContracts.ts']);

const IMPORT_EXPORT_REGEX =
  /(?:^|\n)\s*import(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']|(?:^|\n)\s*export\s+[^;\n]*\sfrom\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_REGEX = /import\(\s*["']([^"']+)["']\s*\)/g;

const toPosix = value => value.split(path.sep).join('/');

const isSourceFile = filePath => {
  const extension = path.extname(filePath);
  if (!SOURCE_EXTENSIONS.has(extension) || filePath.endsWith('.d.ts')) {
    return false;
  }

  const relativePath = toPosix(path.relative(ROOT, filePath));
  if (relativePath.includes('/tests/')) return false;
  if (relativePath.includes('.test.') || relativePath.includes('.spec.')) return false;
  return !relativePath.includes('.stories.');
};

const walkFiles = entryPath => {
  if (!fs.existsSync(entryPath)) {
    return [];
  }

  const stats = fs.statSync(entryPath);
  if (stats.isFile()) {
    return isSourceFile(entryPath) ? [entryPath] : [];
  }

  const files = [];
  for (const entry of fs.readdirSync(entryPath, { withFileTypes: true })) {
    const absolutePath = path.join(entryPath, entry.name);
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

const files = TARGET_PATHS.flatMap(walkFiles);
const violations = [];

for (const absolutePath of files) {
  const importerPath = toPosix(path.relative(ROOT, absolutePath));
  if (ALLOWED_IMPORTERS.has(importerPath)) {
    continue;
  }

  const source = fs.readFileSync(absolutePath, 'utf8');
  IMPORT_EXPORT_REGEX.lastIndex = 0;
  DYNAMIC_IMPORT_REGEX.lastIndex = 0;

  let match;
  while ((match = IMPORT_EXPORT_REGEX.exec(source)) !== null) {
    const importPath = match[1] || match[2];
    if (importPath === RESTRICTED_IMPORT) {
      violations.push(`${importerPath} -> ${importPath}`);
    }
  }

  while ((match = DYNAMIC_IMPORT_REGEX.exec(source)) !== null) {
    if (match[1] === RESTRICTED_IMPORT) {
      violations.push(`${importerPath} -> ${RESTRICTED_IMPORT}`);
    }
  }
}

if (violations.length > 0) {
  console.error('\nCensus export contract boundary violations:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Census export contract boundary checks passed.');
