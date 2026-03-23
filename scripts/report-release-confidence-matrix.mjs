#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildReleaseConfidenceMatrixReport,
  formatReleaseConfidenceMatrixMarkdown,
} from './releaseConfidenceMatrixSupport.mjs';

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports');
const JSON_OUTPUT = path.join(REPORTS_DIR, 'release-confidence-matrix.json');
const MD_OUTPUT = path.join(REPORTS_DIR, 'release-confidence-matrix.md');

const report = buildReleaseConfidenceMatrixReport(ROOT);

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(MD_OUTPUT, `${formatReleaseConfidenceMatrixMarkdown(report)}\n`, 'utf8');

console.log('[release-confidence-matrix] Report generated at reports/release-confidence-matrix.{md,json}');
