#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LAZY_VIEWS_PATH = path.join(ROOT, 'src', 'views', 'LazyViews.ts');
const source = fs.readFileSync(LAZY_VIEWS_PATH, 'utf8');

const violations = [
  ...source.matchAll(/@\/features\/([^/'"]+)\/([^'"]+)/g),
]
  .map(match => ({
    feature: match[1],
    importPath: `@/features/${match[1]}/${match[2]}`,
  }))
  .filter(entry => entry.feature !== 'whatsapp');

if (violations.length > 0) {
  console.error('\nLazyViews feature entrypoint violations:');
  for (const violation of violations) {
    console.error(`- ${violation.importPath}`);
  }
  process.exit(1);
}

console.log('LazyViews feature entrypoint checks passed.');
