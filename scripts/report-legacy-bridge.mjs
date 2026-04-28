#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildLegacyBridgeGovernanceReport,
  formatLegacyBridgeGovernanceMarkdown,
} from './legacyBridgeGovernanceReportSupport.mjs';

const workspaceRoot = process.cwd();

const governanceContent = fs.readFileSync(
  path.join(workspaceRoot, 'src/services/repositories/legacyBridgeGovernance.ts'),
  'utf8'
);
const compatibilityContent = fs.readFileSync(
  path.join(workspaceRoot, 'src/services/repositories/legacyCompatibilityPolicy.ts'),
  'utf8'
);
const pathPolicyContent = fs.readFileSync(
  path.join(workspaceRoot, 'src/services/storage/legacyfirebase/legacyFirebasePaths.ts'),
  'utf8'
);

const report = buildLegacyBridgeGovernanceReport({
  governanceContent,
  compatibilityContent,
  pathPolicyContent,
});

const reportDir = path.join(workspaceRoot, 'reports');
fs.mkdirSync(reportDir, { recursive: true });

fs.writeFileSync(
  path.join(reportDir, 'legacy-bridge-governance.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);

const markdown = formatLegacyBridgeGovernanceMarkdown(report);

fs.writeFileSync(
  path.join(reportDir, 'legacy-bridge-governance.md'),
  `${markdown}\n`,
  'utf8'
);

console.log('[legacy-bridge] Report generated at reports/legacy-bridge-governance.{md,json}');
