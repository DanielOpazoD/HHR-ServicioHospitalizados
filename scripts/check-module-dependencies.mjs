#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');
const MATRIX_PATH = path.join(ROOT, 'scripts', 'module-dependency-matrix.json');
const ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'module-dependency-allowlist.json');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const MODULE_ZONES = ['components', 'hooks', 'services', 'context'];
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

const loadJson = (jsonPath, fallback) => {
  if (!fs.existsSync(jsonPath)) return fallback;
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
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

const getZoneFromPath = relativePath => {
  const match = relativePath.match(/^src\/(components|hooks|services|context)\//);
  return match ? match[1] : null;
};

const matrix = loadJson(MATRIX_PATH, { modules: {} });
const allowlist = loadJson(ALLOWLIST_PATH, { violations: [] });
const knownViolations = new Set(allowlist.violations || []);

const configuredZones = Object.keys(matrix.modules || {}).sort((a, b) => a.localeCompare(b));
const missingInMatrix = MODULE_ZONES.filter(zone => !configuredZones.includes(zone));
const unknownInMatrix = configuredZones.filter(zone => !MODULE_ZONES.includes(zone));

if (missingInMatrix.length > 0 || unknownInMatrix.length > 0) {
  console.error('\nModule dependency matrix is out of sync with configured zones.');
  if (missingInMatrix.length > 0) {
    console.error(`- Missing in matrix: ${missingInMatrix.join(', ')}`);
  }
  if (unknownInMatrix.length > 0) {
    console.error(`- Unknown zones in matrix: ${unknownInMatrix.join(', ')}`);
  }
  process.exit(1);
}

const files = walkFiles(SRC_ROOT);
const currentViolationIds = [];

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

    const allowedDependencies = matrix.modules[importerZone] || [];
    if (!allowedDependencies.includes(importedZone)) {
      currentViolationIds.push(
        `module-dependency-not-allowed|${importerPath}|${importPath}|${importedPath}|${importerZone}|${importedZone}`
      );
    }
  }
}

const newViolations = currentViolationIds.filter(id => !knownViolations.has(id));
if (newViolations.length === 0) {
  console.log('Module dependency matrix checks passed.');
  if (currentViolationIds.length > 0) {
    console.log(`Baseline debt tracked: ${currentViolationIds.length} module boundary issues.`);
  }
  process.exit(0);
}

console.error('\nModule dependency boundary violations:');
for (const violationId of newViolations) {
  const [rule, importerPath, importPath, importedPath, importerZone, importedZone] =
    violationId.split('|');
  console.error(
    `- [${rule}] ${importerPath} (${importerZone}) -> ${importPath} => ${importedPath} (${importedZone})`
  );
}

process.exit(1);
