#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildCiRuntimeCalibrationProfile,
  formatCiRuntimeCalibrationProfileMarkdown,
} from './ciRuntimeTelemetrySupport.mjs';
import { getGitReportState } from './gitReportState.mjs';

const ESTIMATED_PROFILE_PATH = 'reports/unit-shard-runtime-profile.json';
const OBSERVED_PROFILE_PATH = 'reports/ci-runtime-observed-profile.json';
const OUTPUT_JSON_PATH = 'reports/ci-runtime-calibration-profile.json';
const OUTPUT_MD_PATH = 'reports/ci-runtime-calibration-profile.md';

const root = process.cwd();

const readJsonIfExists = relativePath => {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${relativePath} JSON: ${error.message}`);
  }
};

try {
  const estimatedProfile = readJsonIfExists(ESTIMATED_PROFILE_PATH);
  const observedProfile = readJsonIfExists(OBSERVED_PROFILE_PATH);
  const profile = {
    ...buildCiRuntimeCalibrationProfile({
      estimatedProfile,
      observedProfile,
    }),
    generatedAt: new Date().toISOString(),
    ...getGitReportState(root),
    source: {
      estimatedProfilePath: ESTIMATED_PROFILE_PATH,
      observedProfilePath: OBSERVED_PROFILE_PATH,
    },
  };

  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(root, OUTPUT_JSON_PATH), `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(root, OUTPUT_MD_PATH), formatCiRuntimeCalibrationProfileMarkdown(profile), 'utf8');

  console.log('[ci-runtime-calibration-profile] Report generated at reports/ci-runtime-calibration-profile.{json,md}');
} catch (error) {
  console.error(`[ci-runtime-calibration-profile] ${error.message}`);
  process.exit(1);
}
