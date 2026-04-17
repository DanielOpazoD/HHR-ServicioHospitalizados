import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const IMPORT_EXPORT_REGEX =
  /(?:^|\n)\s*import(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']|(?:^|\n)\s*export\s+[^;\n]*\sfrom\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_REGEX = /import\(\s*["']([^"']+)["']\s*\)/g;

const toPosix = value => value.split(path.sep).join('/');

const isSourceFile = filePath => {
  const extension = path.extname(filePath);
  if (!SOURCE_EXTENSIONS.has(extension) || filePath.endsWith('.d.ts')) return false;

  const relativePath = toPosix(path.relative(ROOT, filePath));
  if (relativePath.includes('/tests/')) return false;
  if (relativePath.includes('.test.') || relativePath.includes('.spec.')) return false;
  return !relativePath.includes('.stories.');
};

const walkFiles = entryPath => {
  if (!fs.existsSync(entryPath)) return [];

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

/**
 * Run a "files under <targetPaths> must not import <restrictedImport>"
 * check with an optional allowlist of importers.
 *
 * @param {object} options
 * @param {string[]} options.targetPaths    Paths (files or directories) to walk.
 * @param {string} options.restrictedImport The exact import specifier that is forbidden.
 * @param {string[]} [options.allowedImporters] Files that are permitted to violate the rule.
 * @param {string} options.label            Human-readable label for log output.
 */
export const runRestrictedImportCheck = ({
  targetPaths,
  restrictedImport,
  allowedImporters = [],
  label,
}) => {
  if (!Array.isArray(targetPaths) || targetPaths.length === 0) {
    throw new Error('runRestrictedImportCheck requires a non-empty `targetPaths` array.');
  }
  if (!restrictedImport || !label) {
    throw new Error('runRestrictedImportCheck requires `restrictedImport` and `label`.');
  }

  const absoluteTargets = targetPaths.map(relativePath => path.join(ROOT, relativePath));
  const allowSet = new Set(allowedImporters);
  const files = absoluteTargets.flatMap(walkFiles);
  const violations = [];

  for (const absolutePath of files) {
    const importerPath = toPosix(path.relative(ROOT, absolutePath));
    if (allowSet.has(importerPath)) continue;

    const source = fs.readFileSync(absolutePath, 'utf8');
    IMPORT_EXPORT_REGEX.lastIndex = 0;
    DYNAMIC_IMPORT_REGEX.lastIndex = 0;

    let match;
    while ((match = IMPORT_EXPORT_REGEX.exec(source)) !== null) {
      const importPath = match[1] || match[2];
      if (importPath === restrictedImport) {
        violations.push(`${importerPath} -> ${importPath}`);
      }
    }
    while ((match = DYNAMIC_IMPORT_REGEX.exec(source)) !== null) {
      if (match[1] === restrictedImport) {
        violations.push(`${importerPath} -> ${restrictedImport}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error(`\n${label} violations:`);
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log(`${label} checks passed.`);
};
