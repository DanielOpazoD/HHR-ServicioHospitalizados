export const BUNDLE_RISK_LEDGER_GENERATED_AT = 'stable:bundle-risk-ledger';

const asArray = value => (Array.isArray(value) ? value : []);

const hasChunkBudget = ({ surface, bundleBudgetConfig }) => {
  const pattern = surface.chunkBudgetPattern;
  if (!pattern) return false;
  return asArray(bundleBudgetConfig?.chunkPatternBudgets).some(entry => entry?.pattern === pattern);
};

const hasStartupBudget = ({ surface, bundleBudgetConfig }) => {
  const label = surface.startupBudgetLabel;
  if (!label) return false;
  return asArray(bundleBudgetConfig?.startupChunkBudgets).some(entry => entry?.label === label);
};

const hasPrecacheExclusion = ({ surface, bundleBudgetConfig }) => {
  const pattern = surface.precacheIgnoredPattern;
  if (!pattern) return null;
  return asArray(bundleBudgetConfig?.precacheIgnoredAssetPatterns).includes(pattern);
};

const buildSurface = ({ surface, bundleBudgetConfig }) => {
  const budgetCovered =
    hasChunkBudget({ surface, bundleBudgetConfig }) ||
    hasStartupBudget({ surface, bundleBudgetConfig });
  const precacheExcluded = hasPrecacheExclusion({ surface, bundleBudgetConfig });
  const issues = [];

  if (!budgetCovered) {
    issues.push(`${surface.id} is missing an enforced bundle budget`);
  }
  if (precacheExcluded === false) {
    issues.push(`${surface.id} is missing precache exclusion`);
  }

  return {
    id: surface.id,
    owner: surface.owner,
    workflow: surface.workflow,
    thresholdLabel: surface.thresholdLabel,
    releasePosture: surface.releasePosture,
    guardrails: asArray(surface.guardrails),
    nextAction: surface.nextAction,
    budgetCovered,
    precacheExcluded,
    status: issues.length === 0 ? 'ok' : 'degraded',
    issues,
  };
};

export const buildBundleRiskLedgerReport = ({ ledgerConfig, bundleBudgetConfig }) => {
  const surfaces = asArray(ledgerConfig?.surfaces).map(surface =>
    buildSurface({ surface, bundleBudgetConfig })
  );
  const issues = surfaces.flatMap(surface => surface.issues);

  return {
    generatedAt: BUNDLE_RISK_LEDGER_GENERATED_AT,
    policyVersion: ledgerConfig?.policyVersion || 'unknown',
    status: issues.length === 0 ? 'ok' : 'degraded',
    surfaces,
    issues,
  };
};

export const formatBundleRiskLedgerMarkdown = report => {
  const lines = [
    '# Bundle Risk Ledger Snapshot',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Policy version: ${report.policyVersion}`,
    `- Status: ${report.status}`,
    '',
    '## Surfaces',
    '',
    '| Surface | Owner | Workflow | Status | Budget | Precache |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const surface of report.surfaces) {
    lines.push(
      `| ${surface.id} | ${surface.owner} | ${surface.workflow} | ${surface.status} | ${surface.budgetCovered ? 'covered' : 'missing'} | ${
        surface.precacheExcluded === null ? 'n/a' : surface.precacheExcluded ? 'excluded' : 'missing'
      } |`
    );
  }

  lines.push('', '## Next Actions', '');
  for (const surface of report.surfaces) {
    lines.push(`- ${surface.id}: ${surface.nextAction}`);
  }

  if (report.issues.length > 0) {
    lines.push('', '## Issues', '');
    for (const issue of report.issues) {
      lines.push(`- ${issue}`);
    }
  }

  return lines.join('\n');
};
