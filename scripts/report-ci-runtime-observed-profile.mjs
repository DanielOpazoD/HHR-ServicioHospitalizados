#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildCiRuntimeObservedProfile,
  compareEstimatedAndObservedRuntime,
  formatCiRuntimeObservedProfileMarkdown,
} from './ciRuntimeTelemetrySupport.mjs';
import { getGitReportState } from './gitReportState.mjs';

const DEFAULT_INPUT_PATH = 'reports/ci-runtime-observed-input.json';
const ESTIMATED_PROFILE_PATH = 'reports/unit-shard-runtime-profile.json';
const OUTPUT_JSON_PATH = 'reports/ci-runtime-observed-profile.json';
const OUTPUT_MD_PATH = 'reports/ci-runtime-observed-profile.md';

const root = process.cwd();

const readJsonIfExists = relativePath => {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const inputArgIndex = process.argv.findIndex(arg => arg === '--input');
const inputPath =
  inputArgIndex >= 0 && process.argv[inputArgIndex + 1]
    ? process.argv[inputArgIndex + 1]
    : process.env.CI_RUNTIME_OBSERVED_INPUT || DEFAULT_INPUT_PATH;

const input = readJsonIfExists(inputPath);
const jobs = Array.isArray(input) ? input : input?.jobs || [];
const estimatedProfile = readJsonIfExists(ESTIMATED_PROFILE_PATH);
const profile = {
  ...buildCiRuntimeObservedProfile({
    jobs,
    tolerancePercent: estimatedProfile?.summary?.tolerancePercent || 25,
  }),
  generatedAt: new Date().toISOString(),
  ...getGitReportState(root),
  source: {
    inputPath,
    hasInput: Boolean(input),
  },
};

const comparison = compareEstimatedAndObservedRuntime({
  estimatedProfile,
  observedProfile: profile,
});
const report = {
  ...profile,
  comparison,
};

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, OUTPUT_JSON_PATH), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(root, OUTPUT_MD_PATH), formatCiRuntimeObservedProfileMarkdown(report), 'utf8');

console.log('[ci-runtime-observed-profile] Report generated at reports/ci-runtime-observed-profile.{json,md}');
