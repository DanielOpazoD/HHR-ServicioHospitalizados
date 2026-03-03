#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

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

const policyVersionMatch = governanceContent.match(
  /LEGACY_BRIDGE_POLICY_VERSION\s*=\s*'([^']+)'/
);
const entrypointsMatch = governanceContent.match(
  /LEGACY_BRIDGE_ALLOWED_ENTRYPOINTS\s*=\s*\[([\s\S]*?)\]\s*as const/
);
const gateMatches = [
  ...governanceContent.matchAll(
    /id:\s*'([^']+)',[\s\S]*?label:\s*'([^']+)',[\s\S]*?rationale:\s*'([^']+)'/g
  ),
];
const modeMatches = [...compatibilityContent.matchAll(/'([^']+)'/g)].map(match => match[1]);
const recordDocPathMatches = [
  ...pathPolicyContent.matchAll(/`([^`]*\$?\{?date\}?[^`]*)`|'([^']*dailyRecords[^']*|records\/\$\{date\})'/g),
];

const allowedModes = Array.from(
  new Set(modeMatches.filter(mode => mode === 'explicit_bridge' || mode === 'disabled'))
);
const allowedEntrypoints = entrypointsMatch
  ? [...entrypointsMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1])
  : [];
const retirementGates = gateMatches.map(match => ({
  id: match[1],
  label: match[2],
  rationale: match[3],
}));
const candidatePathTemplates = Array.from(
  new Set(
    recordDocPathMatches
      .map(match => match[1] || match[2] || '')
      .map(template => template.replaceAll('${date}', ':date'))
      .filter(Boolean)
  )
);

const report = {
  generatedAt: new Date().toISOString(),
  policyVersion: policyVersionMatch?.[1] ?? 'unknown',
  allowedModes,
  hotPathPolicy: 'disabled',
  allowedEntrypoints,
  retirementPhaseRules: {
    observe: 'Use only while hot path isolation or governance prerequisites are incomplete.',
    restrict: 'Default stage once bridge is explicit-only and auditable.',
    retire_ready: 'Allowed only when runtime mode is disabled and a release window passed without dependency.',
  },
  retirementGates,
  candidatePathTemplates,
};

const reportDir = path.join(workspaceRoot, 'reports');
fs.mkdirSync(reportDir, { recursive: true });

fs.writeFileSync(
  path.join(reportDir, 'legacy-bridge-governance.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);

const markdown = `# Legacy Bridge Governance Snapshot

- Generated: ${report.generatedAt}
- Policy version: ${report.policyVersion}
- Allowed modes: ${report.allowedModes.join(', ') || 'unknown'}
- Hot path policy: ${report.hotPathPolicy}

## Allowed Entrypoints

${report.allowedEntrypoints.map(entrypoint => `- \`${entrypoint}\``).join('\n')}

## Retirement Gates

| Gate | Label | Rationale |
| --- | --- | --- |
${report.retirementGates.map(gate => `| ${gate.id} | ${gate.label} | ${gate.rationale} |`).join('\n')}

## Candidate Path Templates

${report.candidatePathTemplates.map(template => `- \`${template}\``).join('\n')}

## Retirement Phases

- \`observe\`: ${report.retirementPhaseRules.observe}
- \`restrict\`: ${report.retirementPhaseRules.restrict}
- \`retire_ready\`: ${report.retirementPhaseRules.retire_ready}
`;

fs.writeFileSync(
  path.join(reportDir, 'legacy-bridge-governance.md'),
  `${markdown}\n`,
  'utf8'
);

console.log('[legacy-bridge] Report generated at reports/legacy-bridge-governance.{md,json}');
