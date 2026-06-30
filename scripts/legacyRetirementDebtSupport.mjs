export const LEGACY_RETIREMENT_DEBT_GENERATED_AT = 'stable:legacy-retirement-debt';

const asArray = value => (Array.isArray(value) ? value : []);

const asNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasNumericBudget = value => Number.isFinite(Number(value));

const countCompatibilityEntries = compatibilityGovernanceReport =>
  asArray(compatibilityGovernanceReport?.entries).length;

const countBridgeEntrypoints = legacyBridgeReport =>
  asArray(legacyBridgeReport?.allowedEntrypoints).length;

const countBridgeImporters = legacyBridgeReport =>
  asArray(legacyBridgeReport?.allowedImporters).length;

const createSurfaceResult = ({ surface, status, signal, issues }) => ({
  id: surface.id,
  label: surface.label || surface.id,
  owner: surface.owner || 'unknown',
  phase: surface.phase || 'unknown',
  status,
  signal,
  guardrails: asArray(surface.guardrails),
  evidenceReports: asArray(surface.evidenceReports),
  retirementCriteria: surface.retirementCriteria || '',
  nextAction: surface.nextAction || '',
  issues,
});

const buildLegacyReadBridgeSurface = ({ surface, legacyBridgeReport }) => {
  const entrypoints = countBridgeEntrypoints(legacyBridgeReport);
  const importers = countBridgeImporters(legacyBridgeReport);
  const maxEntrypoints = asNumber(surface.maxAuthorizedEntrypoints);
  const maxImporters = asNumber(surface.maxAuthorizedImporters);
  const hasEntrypointBudget = hasNumericBudget(surface.maxAuthorizedEntrypoints);
  const hasImporterBudget = hasNumericBudget(surface.maxAuthorizedImporters);
  const issues = [];

  if (hasEntrypointBudget && entrypoints > maxEntrypoints) {
    issues.push(
      `${surface.id} authorized entrypoints ${entrypoints} exceed budget ${maxEntrypoints}`
    );
  }
  if (hasImporterBudget && importers > maxImporters) {
    issues.push(`${surface.id} authorized importers ${importers} exceed budget ${maxImporters}`);
  }

  return createSurfaceResult({
    surface,
    status: issues.length === 0 ? 'ok' : 'degraded',
    signal: `entrypoints=${entrypoints}/${hasEntrypointBudget ? maxEntrypoints : 'n/a'}, importers=${importers}/${hasImporterBudget ? maxImporters : 'n/a'}`,
    issues,
  });
};

const buildRoleAliasSurface = ({ surface, compatibilityGovernanceReport }) => {
  const governedEntries = countCompatibilityEntries(compatibilityGovernanceReport);
  const maxGovernedEntries = asNumber(surface.maxGovernedEntries);
  const hasGovernedEntryBudget = hasNumericBudget(surface.maxGovernedEntries);
  const missingEntries = asArray(compatibilityGovernanceReport?.missingEntries);
  const issues = [];

  if (hasGovernedEntryBudget && governedEntries > maxGovernedEntries) {
    issues.push(
      `${surface.id} governed entries ${governedEntries} exceed budget ${maxGovernedEntries}`
    );
  }
  if (missingEntries.length > 0) {
    issues.push(`${surface.id} has missing governed entries: ${missingEntries.join(', ')}`);
  }

  return createSurfaceResult({
    surface,
    status: issues.length === 0 ? 'ok' : 'degraded',
    signal: `governedEntries=${governedEntries}/${hasGovernedEntryBudget ? maxGovernedEntries : 'n/a'}, missing=${missingEntries.length}`,
    issues,
  });
};

const buildConsumerBudgetSurface = ({ surface, observedConsumersBySurface }) => {
  const approvedConsumers = asArray(surface.approvedConsumers);
  const observedConsumers = asArray(observedConsumersBySurface?.[surface.id]);
  const consumers = observedConsumers.length > 0 ? observedConsumers : approvedConsumers;
  const maxAuthorizedConsumers = asNumber(surface.maxAuthorizedConsumers);
  const hasConsumerBudget = hasNumericBudget(surface.maxAuthorizedConsumers);
  const unapprovedConsumers = observedConsumers.filter(
    consumer => !approvedConsumers.includes(consumer)
  );
  const issues = [];

  if (hasConsumerBudget && consumers.length > maxAuthorizedConsumers) {
    issues.push(
      `${surface.id} authorized consumers ${consumers.length} exceed budget ${maxAuthorizedConsumers}`
    );
  }
  if (unapprovedConsumers.length > 0) {
    issues.push(`${surface.id} has unapproved consumers: ${unapprovedConsumers.join(', ')}`);
  }

  return createSurfaceResult({
    surface,
    status: issues.length === 0 ? 'ok' : 'degraded',
    signal: `consumers=${consumers.length}/${hasConsumerBudget ? maxAuthorizedConsumers : 'n/a'}, unapproved=${unapprovedConsumers.length}`,
    issues,
  });
};

const buildGenericSurface = surface =>
  createSurfaceResult({
    surface,
    status: 'ok',
    signal: 'documented',
    issues: [],
  });

const buildSurface = ({
  surface,
  legacyBridgeReport,
  compatibilityGovernanceReport,
  observedConsumersBySurface,
}) => {
  if (surface.id === 'legacy-read-bridge') {
    return buildLegacyReadBridgeSurface({ surface, legacyBridgeReport });
  }
  if (surface.id === 'role-aliases') {
    return buildRoleAliasSurface({ surface, compatibilityGovernanceReport });
  }
  if (surface.maxAuthorizedConsumers != null) {
    return buildConsumerBudgetSurface({ surface, observedConsumersBySurface });
  }

  return buildGenericSurface(surface);
};

export const buildLegacyRetirementDebtReport = ({
  config,
  legacyBridgeReport = {},
  compatibilityGovernanceReport = {},
  observedConsumersBySurface = {},
}) => {
  const surfaces = asArray(config?.surfaces).map(surface =>
    buildSurface({
      surface,
      legacyBridgeReport,
      compatibilityGovernanceReport,
      observedConsumersBySurface,
    })
  );
  const maxOpenSurfaces = asNumber(config?.maxOpenSurfaces);
  const openSurfaceCount = surfaces.filter(surface => surface.phase !== 'retired').length;
  const issues = surfaces.flatMap(surface => surface.issues);

  if (maxOpenSurfaces > 0 && openSurfaceCount > maxOpenSurfaces) {
    issues.push(`open legacy surfaces ${openSurfaceCount} exceed budget ${maxOpenSurfaces}`);
  }

  return {
    generatedAt: LEGACY_RETIREMENT_DEBT_GENERATED_AT,
    policyVersion: config?.policyVersion || 'unknown',
    status: issues.length === 0 ? 'ok' : 'degraded',
    openSurfaceCount,
    maxOpenSurfaces,
    surfaces,
    issues,
  };
};

export const formatLegacyRetirementDebtMarkdown = report => {
  const lines = [
    '# Legacy Retirement Debt Snapshot',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Policy version: ${report.policyVersion}`,
    `- Status: ${report.status}`,
    `- Open surfaces: ${report.openSurfaceCount}/${report.maxOpenSurfaces || 'n/a'}`,
    '',
    '## Surfaces',
    '',
    '| Surface | Owner | Phase | Status | Signal | Next action |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const surface of report.surfaces) {
    lines.push(
      `| ${surface.label} | ${surface.owner} | ${surface.phase} | ${surface.status} | ${surface.signal} | ${surface.nextAction} |`
    );
  }

  lines.push('', '## Evidence', '');
  for (const surface of report.surfaces) {
    lines.push(`### ${surface.label}`, '');
    lines.push(`- Retirement criteria: ${surface.retirementCriteria || 'n/a'}`);
    lines.push(`- Guardrails: ${surface.guardrails.join(', ') || 'n/a'}`);
    lines.push(`- Reports: ${surface.evidenceReports.join(', ') || 'n/a'}`);
    if (surface.issues.length > 0) {
      lines.push(`- Issues: ${surface.issues.join('; ')}`);
    }
    lines.push('');
  }

  if (report.issues.length > 0) {
    lines.push('## Issues', '');
    for (const issue of report.issues) {
      lines.push(`- ${issue}`);
    }
  }

  return lines.join('\n').trimEnd();
};
