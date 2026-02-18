#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');
const MATRIX_PATH = path.join(ROOT, 'scripts', 'folder-dependency-matrix.json');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'dependency-debt.md');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IMPORT_REGEX =
  /(?:^|\n)\s*import(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']|(?:^|\n)\s*export\s+[^;\n]*\sfrom\s*["']([^"']+)["']/g;

const toPosix = value => value.split(path.sep).join('/');

const isSourceFile = filePath => {
  const extension = path.extname(filePath);
  if (!SOURCE_EXTENSIONS.has(extension)) return false;
  if (filePath.endsWith('.d.ts')) return false;

  const relativePath = toPosix(path.relative(ROOT, filePath));
  if (relativePath.includes('/tests/')) return false;
  if (relativePath.includes('.test.') || relativePath.includes('.spec.')) return false;
  return !relativePath.includes('.stories.');
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

const resolveImport = (importerFilePath, importPath) => {
  if (!importPath.startsWith('@/') && !importPath.startsWith('.')) return null;

  const basePath = importPath.startsWith('@/')
    ? path.join(SRC_ROOT, importPath.slice(2))
    : path.resolve(path.dirname(importerFilePath), importPath);

  const candidates = [];
  if (path.extname(basePath)) {
    candidates.push(basePath);
  } else {
    for (const extension of SOURCE_EXTENSIONS) {
      candidates.push(`${basePath}${extension}`);
    }
    for (const extension of SOURCE_EXTENSIONS) {
      candidates.push(path.join(basePath, `index${extension}`));
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.normalize(candidate);
    }
  }

  return null;
};

const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
const knownZones = new Set(Object.keys(matrix.zones || {}));

const getZoneFromPath = relativePath => {
  const normalized = toPosix(relativePath);
  const parts = normalized.replace(/^src\//, '').split('/');
  const zone = parts[0];
  return knownZones.has(zone) ? zone : null;
};

const files = walkFiles(SRC_ROOT);
const violations = [];

for (const absolutePath of files) {
  const importerPath = toPosix(path.relative(ROOT, absolutePath));
  const importerZone = getZoneFromPath(importerPath);
  if (!importerZone) continue;

  const source = fs.readFileSync(absolutePath, 'utf8');
  IMPORT_REGEX.lastIndex = 0;
  let match;

  while ((match = IMPORT_REGEX.exec(source)) !== null) {
    const importPath = match[1] || match[2];
    if (!importPath) continue;

    const resolvedPath = resolveImport(absolutePath, importPath);
    if (!resolvedPath) continue;

    const importedPath = toPosix(path.relative(ROOT, resolvedPath));
    const importedZone = getZoneFromPath(importedPath);
    if (!importedZone || importedZone === importerZone) continue;

    const allowedDependencies = matrix.zones[importerZone]?.allowedDependencies || [];
    if (!allowedDependencies.includes(importedZone)) {
      violations.push({
        importerPath,
        importPath,
        importedPath,
        importerZone,
        importedZone,
      });
    }
  }
}

const uniqueViolations = Array.from(
  new Map(
    violations.map(violation => [
      `${violation.importerPath}|${violation.importPath}|${violation.importedPath}|${violation.importerZone}|${violation.importedZone}`,
      violation,
    ])
  ).values()
).sort((a, b) => a.importerPath.localeCompare(b.importerPath));

const byZonePair = new Map();
const byImporterFile = new Map();

for (const violation of uniqueViolations) {
  const pair = `${violation.importerZone} -> ${violation.importedZone}`;
  byZonePair.set(pair, (byZonePair.get(pair) || 0) + 1);
  byImporterFile.set(violation.importerPath, (byImporterFile.get(violation.importerPath) || 0) + 1);
}

const topPairs = [...byZonePair.entries()].sort((a, b) => b[1] - a[1]);
const topImporters = [...byImporterFile.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);

const now = new Date();
const lines = [];
lines.push('# Folder Dependency Debt Report');
lines.push('');
lines.push(`Generated at: ${now.toISOString()}`);
lines.push('');
lines.push(`Current violations: **${uniqueViolations.length}**`);
lines.push('');
lines.push('## Violations by Zone Pair');
lines.push('');
lines.push('| Zone Pair | Count |');
lines.push('| --- | ---: |');
for (const [pair, count] of topPairs) {
  lines.push(`| ${pair} | ${count} |`);
}
lines.push('');
lines.push('## Top Importer Files');
lines.push('');
lines.push('| File | Violations |');
lines.push('| --- | ---: |');
for (const [file, count] of topImporters) {
  lines.push(`| \`${file}\` | ${count} |`);
}
lines.push('');
lines.push('## Full Violation List');
lines.push('');
for (const violation of uniqueViolations) {
  lines.push(
    `- \`${violation.importerPath}\` (${violation.importerZone}) -> \`${violation.importPath}\` => \`${violation.importedPath}\` (${violation.importedZone})`
  );
}
lines.push('');

fs.writeFileSync(OUTPUT_PATH, `${lines.join('\n')}`, 'utf8');
console.log(`Dependency debt report written to ${path.relative(ROOT, OUTPUT_PATH)} (${uniqueViolations.length} violations).`);
