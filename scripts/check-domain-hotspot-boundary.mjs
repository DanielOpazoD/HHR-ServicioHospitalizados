#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_ROOTS = ['src/application', 'src/features', 'src/shared'].map(relativePath =>
  path.join(ROOT, relativePath)
);
const CONFIG_PATH = path.join(ROOT, 'scripts', 'config', 'domain-hotspot-boundary-baseline.json');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const toPosix = value => value.split(path.sep).join('/');

const isSourceFile = filePath => {
  const extension = path.extname(filePath);
  if (!SOURCE_EXTENSIONS.has(extension) || filePath.endsWith('.d.ts')) {
    return false;
  }

  const relativePath = toPosix(path.relative(ROOT, filePath));
  if (
    relativePath.includes('/tests/') ||
    relativePath.includes('.test.') ||
    relativePath.includes('.spec.') ||
    relativePath.includes('.stories.')
  ) {
    return false;
  }

  return true;
};

const walkFiles = dirPath => {
  const files = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
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

const scopedConfigs = config.scopes.map(scope => ({
  ...scope,
  pattern: new RegExp(
    `from\\s+['"]${scope.module.replace(/[.*+?^${}()|[\]\\\\]/g, '\\\\$&')}['"]|import\\s+['"]${scope.module.replace(/[.*+?^${}()|[\]\\\\]/g, '\\\\$&')}['"]`
  ),
  allowedFiles: new Set(scope.allowedFiles.map(filePath => path.normalize(path.join(ROOT, filePath)))),
}));

const violations = [];

for (const scopedRoot of SRC_ROOTS) {
  for (const filePath of walkFiles(scopedRoot)) {
    const normalizedPath = path.normalize(filePath);
    const source = fs.readFileSync(filePath, 'utf8');

    for (const scope of scopedConfigs) {
      if (scope.allowedFiles.has(normalizedPath)) {
        continue;
      }

      if (scope.pattern.test(source)) {
        violations.push({
          scope: scope.id,
          module: scope.module,
          file: toPosix(path.relative(ROOT, filePath)),
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('\nDomain hotspot imports are restricted to explicit ports/facades:');
  for (const violation of violations) {
    console.error(`- [${violation.scope}] ${violation.file} -> ${violation.module}`);
  }
  process.exit(1);
}

console.log('Domain hotspot boundary checks passed.');
