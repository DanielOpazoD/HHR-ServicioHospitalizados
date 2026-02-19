#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');
const TEST_ROOT = path.join(SRC_ROOT, 'tests');
const REPORTS_DIR = path.join(ROOT, 'reports');
const JSON_OUTPUT = path.join(REPORTS_DIR, 'quality-metrics.json');
const MD_OUTPUT = path.join(REPORTS_DIR, 'quality-metrics.md');
const MODULE_ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'module-size-allowlist.json');
const FOLDER_MATRIX_PATH = path.join(ROOT, 'scripts', 'folder-dependency-matrix.json');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
const IMPORT_REGEX =
  /(?:^|\n)\s*import(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']|(?:^|\n)\s*export\s+[^;\n]*\sfrom\s*["']([^"']+)["']/g;

const ALLOWED_SKIP_FILES = new Set(['src/tests/security/firestore-rules.test.ts']);

const toPosix = value => value.split(path.sep).join('/');

const safeReadJson = filePath => {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const walkFiles = dirPath => {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
};

const countLines = text => (text.length === 0 ? 0 : text.split('\n').length);

const getGitSha = () => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const getSourceMetrics = () => {
  const files = walkFiles(SRC_ROOT).filter(filePath => {
    const extension = path.extname(filePath);
    if (!SOURCE_EXTENSIONS.has(extension)) return false;
    if (filePath.endsWith('.d.ts')) return false;
    const relative = toPosix(path.relative(ROOT, filePath));
    return !relative.includes('.stories.') && !relative.includes('/tests/');
  });

  const byZone = new Map();
  let totalLines = 0;

  for (const filePath of files) {
    const relative = toPosix(path.relative(ROOT, filePath));
    const source = fs.readFileSync(filePath, 'utf8');
    totalLines += countLines(source);

    const zone = relative.replace(/^src\//, '').split('/')[0] || 'unknown';
    byZone.set(zone, (byZone.get(zone) || 0) + 1);
  }

  const zones = [...byZone.entries()]
    .map(([zone, fileCount]) => ({ zone, fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount);

  return {
    fileCount: files.length,
    lineCount: totalLines,
    zones,
  };
};

const getModuleSizeMetrics = () => {
  const allowlist = safeReadJson(MODULE_ALLOWLIST_PATH) || {};
  const globalMax = typeof allowlist.globalMax === 'number' ? allowlist.globalMax : 400;
  const perFileAllowlist = allowlist.allowlist && typeof allowlist.allowlist === 'object' ? allowlist.allowlist : {};

  const files = walkFiles(SRC_ROOT).filter(filePath => {
    const extension = path.extname(filePath);
    if (!['.ts', '.tsx'].includes(extension)) return false;
    if (filePath.endsWith('.d.ts')) return false;
    const relative = toPosix(path.relative(ROOT, filePath));
    return !relative.includes('/tests/') && !relative.includes('.test.') && !relative.includes('.spec.');
  });

  const violations = [];

  for (const filePath of files) {
    const relative = toPosix(path.relative(ROOT, filePath));
    const lineCount = countLines(fs.readFileSync(filePath, 'utf8'));
    const fileLimit = typeof perFileAllowlist[relative] === 'number' ? perFileAllowlist[relative] : globalMax;

    if (lineCount > fileLimit) {
      violations.push({
        file: relative,
        lines: lineCount,
        limit: fileLimit,
      });
    }
  }

  violations.sort((a, b) => b.lines - a.lines);

  return {
    globalMax,
    oversizedCount: violations.length,
    topOversized: violations.slice(0, 10),
  };
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

const getFolderDependencyDebtMetrics = () => {
  const matrix = safeReadJson(FOLDER_MATRIX_PATH);
  if (!matrix || !matrix.zones || typeof matrix.zones !== 'object') {
    return {
      violations: 0,
      topZonePairs: [],
    };
  }

  const knownZones = new Set(Object.keys(matrix.zones));
  const files = walkFiles(SRC_ROOT).filter(filePath => {
    const extension = path.extname(filePath);
    if (!SOURCE_EXTENSIONS.has(extension)) return false;
    if (filePath.endsWith('.d.ts')) return false;
    const relative = toPosix(path.relative(ROOT, filePath));
    return !relative.includes('/tests/') && !relative.includes('.test.') && !relative.includes('.spec.');
  });

  const getZone = relativePath => {
    const zone = relativePath.replace(/^src\//, '').split('/')[0];
    return knownZones.has(zone) ? zone : null;
  };

  const uniqueViolations = new Map();
  const pairCounts = new Map();

  for (const filePath of files) {
    const importer = toPosix(path.relative(ROOT, filePath));
    const importerZone = getZone(importer);
    if (!importerZone) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    IMPORT_REGEX.lastIndex = 0;
    let match;

    while ((match = IMPORT_REGEX.exec(content)) !== null) {
      const importPath = match[1] || match[2];
      if (!importPath) continue;

      const resolved = resolveImport(filePath, importPath);
      if (!resolved) continue;

      const imported = toPosix(path.relative(ROOT, resolved));
      const importedZone = getZone(imported);
      if (!importedZone || importedZone === importerZone) continue;

      const allowed = matrix.zones[importerZone]?.allowedDependencies || [];
      if (allowed.includes(importedZone)) continue;

      const key = `${importer}|${importPath}|${imported}`;
      uniqueViolations.set(key, true);

      const pair = `${importerZone}->${importedZone}`;
      pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
    }
  }

  const topZonePairs = [...pairCounts.entries()]
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    violations: uniqueViolations.size,
    topZonePairs,
  };
};

const getTestMetrics = () => {
  const testFiles = walkFiles(TEST_ROOT).filter(filePath => TEST_FILE_PATTERN.test(filePath));

  let skipCount = 0;
  let onlyCount = 0;
  let flakeRiskFiles = 0;

  const skipPattern = /\b(?:it|test|describe)\.skip\s*\(/g;
  const onlyPattern = /\b(?:it|test|describe)\.only\s*\(/g;

  for (const filePath of testFiles) {
    const relative = toPosix(path.relative(ROOT, filePath));
    const content = fs.readFileSync(filePath, 'utf8');

    const skipMatches = content.match(skipPattern)?.length || 0;
    if (!ALLOWED_SKIP_FILES.has(relative)) {
      skipCount += skipMatches;
    }

    onlyCount += content.match(onlyPattern)?.length || 0;

    const hasFlakeSignals =
      /Math\.random\s*\(/.test(content) ||
      /Date\.now\s*\(/.test(content) ||
      /new\s+Date\s*\(/.test(content) ||
      /setTimeout\s*\(/.test(content) ||
      /setInterval\s*\(/.test(content);

    const hasFakeTimerControls = /vi\.useFakeTimers\s*\(/.test(content) || /jest\.useFakeTimers\s*\(/.test(content);

    if (hasFlakeSignals && !hasFakeTimerControls) {
      flakeRiskFiles += 1;
    }
  }

  return {
    testFileCount: testFiles.length,
    skippedMarkers: skipCount,
    onlyMarkers: onlyCount,
    flakeRiskFiles,
  };
};

const getTypeSafetySignals = () => {
  const files = walkFiles(SRC_ROOT).filter(filePath => {
    const extension = path.extname(filePath);
    return extension === '.ts' || extension === '.tsx';
  });

  let explicitAnyCount = 0;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    explicitAnyCount += content.match(/:\s*any\b/g)?.length || 0;
    explicitAnyCount += content.match(/\bas\s+any\b/g)?.length || 0;
  }

  return { explicitAnyCount };
};

const generatedAt = new Date().toISOString();
const metrics = {
  generatedAt,
  gitSha: getGitSha(),
  source: getSourceMetrics(),
  moduleSize: getModuleSizeMetrics(),
  folderDependencyDebt: getFolderDependencyDebtMetrics(),
  tests: getTestMetrics(),
  typeSafety: getTypeSafetySignals(),
};

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');

const mdLines = [
  '# Quality Metrics Snapshot',
  '',
  `Generated at: ${metrics.generatedAt}`,
  `Commit: ${metrics.gitSha}`,
  '',
  '## Source',
  '',
  `- Files: ${metrics.source.fileCount}`,
  `- Lines: ${metrics.source.lineCount}`,
  '',
  '## Module Size',
  '',
  `- Global line limit: ${metrics.moduleSize.globalMax}`,
  `- Oversized modules: ${metrics.moduleSize.oversizedCount}`,
  '',
  '## Folder Dependency Debt',
  '',
  `- Violations: ${metrics.folderDependencyDebt.violations}`,
  '',
  '## Tests',
  '',
  `- Test files: ${metrics.tests.testFileCount}`,
  `- Forbidden .skip markers: ${metrics.tests.skippedMarkers}`,
  `- Forbidden .only markers: ${metrics.tests.onlyMarkers}`,
  `- Flake-risk test files: ${metrics.tests.flakeRiskFiles}`,
  '',
  '## Type Safety Signals',
  '',
  `- Explicit any occurrences: ${metrics.typeSafety.explicitAnyCount}`,
  '',
];

fs.writeFileSync(MD_OUTPUT, `${mdLines.join('\n')}`, 'utf8');

console.log(`Quality metrics written to ${path.relative(ROOT, JSON_OUTPUT)} and ${path.relative(ROOT, MD_OUTPUT)}.`);
