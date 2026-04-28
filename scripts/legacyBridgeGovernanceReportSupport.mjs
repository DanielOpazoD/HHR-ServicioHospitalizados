export const LEGACY_BRIDGE_GOVERNANCE_GENERATED_AT = 'stable:legacy-bridge-governance';

const extractStringList = content =>
  content ? [...content.matchAll(/'([^']+)'/g)].map(match => match[1]) : [];

export const buildLegacyBridgeGovernanceReport = ({
  governanceContent,
  compatibilityContent,
  pathPolicyContent,
}) => {
  const policyVersionMatch = governanceContent.match(
    /LEGACY_BRIDGE_POLICY_VERSION\s*=\s*'([^']+)'/
  );
  const entrypointsMatch = governanceContent.match(
    /LEGACY_BRIDGE_ALLOWED_ENTRYPOINTS\s*=\s*\[([\s\S]*?)\]\s*as const/
  );
  const importersMatch = governanceContent.match(
    /LEGACY_BRIDGE_ALLOWED_IMPORTERS\s*=\s*\[([\s\S]*?)\]\s*as const/
  );
  const gateMatches = [
    ...governanceContent.matchAll(
      /id:\s*'([^']+)',[\s\S]*?label:\s*'([^']+)',[\s\S]*?rationale:\s*'([^']+)'/g
    ),
  ];
  const modeMatches = extractStringList(compatibilityContent);
  const recordDocPathMatches = [
    ...pathPolicyContent.matchAll(
      /`([^`]*\$?\{?date\}?[^`]*)`|'([^']*dailyRecords[^']*|records\/\$\{date\})'/g
    ),
  ];

  const allowedModes = Array.from(
    new Set(modeMatches.filter(mode => mode === 'explicit_bridge' || mode === 'disabled'))
  );
  const allowedEntrypoints = entrypointsMatch ? extractStringList(entrypointsMatch[1]) : [];
  const allowedImporters = importersMatch ? extractStringList(importersMatch[1]) : [];
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

  return {
    generatedAt: LEGACY_BRIDGE_GOVERNANCE_GENERATED_AT,
    policyVersion: policyVersionMatch?.[1] ?? 'unknown',
    allowedModes,
    hotPathPolicy: 'disabled',
    allowedEntrypoints,
    allowedImporters,
    retirementPhaseRules: {
      observe: 'Use only while hot path isolation or governance prerequisites are incomplete.',
      restrict: 'Default stage once bridge is explicit-only and auditable.',
      retire_ready:
        'Allowed only when runtime mode is disabled and a release window passed without dependency.',
    },
    retirementGates,
    candidatePathTemplates,
  };
};

export const formatLegacyBridgeGovernanceMarkdown = report => `# Legacy Bridge Governance Snapshot

- Generated: ${report.generatedAt}
- Policy version: ${report.policyVersion}
- Allowed modes: ${report.allowedModes.join(', ') || 'unknown'}
- Hot path policy: ${report.hotPathPolicy}

## Allowed Entrypoints

${report.allowedEntrypoints.map(entrypoint => `- \`${entrypoint}\``).join('\n')}

## Allowed Importers

${report.allowedImporters.map(importer => `- \`${importer}\``).join('\n')}

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
