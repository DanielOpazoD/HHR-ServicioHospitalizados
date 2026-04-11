#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildReleaseReadinessScorecard,
  formatReleaseReadinessScorecardMarkdown,
} from './releaseReadinessScorecardSupport.mjs';

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports');
const JSON_OUTPUT = path.join(REPORTS_DIR, 'release-readiness-scorecard.json');
const MD_OUTPUT = path.join(REPORTS_DIR, 'release-readiness-scorecard.md');

const getGitSha = () => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const report = {
  ...buildReleaseReadinessScorecard(ROOT),
  gitSha: getGitSha(),
};

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(MD_OUTPUT, `${formatReleaseReadinessScorecardMarkdown(report)}\n`, 'utf8');

console.log('[release-readiness-scorecard] Report generated at reports/release-readiness-scorecard.{md,json}');
