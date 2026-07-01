const reportNode = ({ command, artifacts, dependencies = [] }) => ({
  command,
  artifacts,
  dependencies,
});

export const EVIDENCE_DEPENDENCY_GRAPH = {
  'quality-metrics': reportNode({
    command: 'report:quality-metrics',
    artifacts: ['reports/quality-metrics.json', 'reports/quality-metrics.md'],
  }),
  'bundle-risk-ledger': reportNode({
    command: 'report:bundle-risk-ledger',
    artifacts: ['reports/bundle-risk-ledger.json', 'reports/bundle-risk-ledger.md'],
  }),
  'legacy-bridge': reportNode({
    command: 'report:legacy-bridge',
    artifacts: ['reports/legacy-bridge-governance.json', 'reports/legacy-bridge-governance.md'],
  }),
  'compatibility-governance': reportNode({
    command: 'report:compatibility-governance',
    artifacts: ['reports/compatibility-governance.json', 'reports/compatibility-governance.md'],
  }),
  'legacy-retirement-debt': reportNode({
    command: 'report:legacy-retirement-debt',
    artifacts: ['reports/legacy-retirement-debt.json', 'reports/legacy-retirement-debt.md'],
    dependencies: ['quality-metrics'],
  }),
  'compatibility-import-governance': reportNode({
    command: 'report:compatibility-import-governance',
    artifacts: [
      'reports/compatibility-import-governance.json',
      'reports/compatibility-import-governance.md',
    ],
  }),
  'critical-coverage': reportNode({
    command: 'report:critical-coverage',
    artifacts: ['reports/critical-coverage.json', 'reports/critical-coverage.md'],
    dependencies: [
      'scripts/config/critical-coverage-thresholds.json',
      'scripts/criticalCoverageSupport.mjs',
      'scripts/report-critical-coverage.mjs',
      'scripts/run-critical-coverage.mjs',
      'vitest.critical-coverage.config.ts',
    ],
  }),
  'operational-health': reportNode({
    command: 'report:operational-health',
    artifacts: ['reports/operational-health.json', 'reports/operational-health.md'],
    dependencies: ['critical-coverage', 'reports/e2e/preview-bootstrap/report.json'],
  }),
  'system-confidence': reportNode({
    command: 'report:system-confidence',
    artifacts: ['reports/system-confidence.json', 'reports/system-confidence.md'],
    dependencies: ['quality-metrics', 'critical-coverage', 'operational-health'],
  }),
  'release-confidence-matrix': reportNode({
    command: 'report:release-confidence-matrix',
    artifacts: ['reports/release-confidence-matrix.json', 'reports/release-confidence-matrix.md'],
    dependencies: ['critical-coverage'],
  }),
  'technical-ownership-map': reportNode({
    command: 'report:technical-ownership-map',
    artifacts: ['reports/technical-ownership-map.json', 'reports/technical-ownership-map.md'],
  }),
  'guardrail-governance': reportNode({
    command: 'report:guardrail-governance',
    artifacts: ['reports/guardrail-governance.json', 'reports/guardrail-governance.md'],
  }),
  'clinical-release-signoff': reportNode({
    command: 'report:clinical-release-signoff',
    artifacts: ['reports/clinical-release-signoff.json', 'reports/clinical-release-signoff.md'],
    dependencies: ['scripts/config/clinical-release-signoff.json'],
  }),
  'clinical-release-validation': reportNode({
    command: 'report:clinical-release-validation',
    artifacts: ['reports/clinical-release-validation.json', 'reports/clinical-release-validation.md'],
  }),
  'runtime-contracts': reportNode({
    command: 'report:runtime-contracts',
    artifacts: ['reports/runtime-contracts.json', 'reports/runtime-contracts.md'],
  }),
  'serverless-runtime-governance': reportNode({
    command: 'report:serverless-runtime-governance',
    artifacts: [
      'reports/serverless-runtime-governance.json',
      'reports/serverless-runtime-governance.md',
    ],
  }),
  'serverless-sensitive-coverage': reportNode({
    command: 'report:serverless-sensitive-coverage',
    artifacts: [
      'reports/serverless-sensitive-coverage.json',
      'reports/serverless-sensitive-coverage.md',
    ],
  }),
  'sustainable-change-policy': reportNode({
    command: 'report:sustainable-change-policy',
    artifacts: ['reports/sustainable-change-policy.json', 'reports/sustainable-change-policy.md'],
  }),
  'maintenance-debt-scorecard': reportNode({
    command: 'report:maintenance-debt-scorecard',
    artifacts: ['reports/maintenance-debt-scorecard.json', 'reports/maintenance-debt-scorecard.md'],
    dependencies: ['quality-metrics'],
  }),
  'release-readiness-scorecard': reportNode({
    command: 'report:release-readiness-scorecard',
    artifacts: ['reports/release-readiness-scorecard.json', 'reports/release-readiness-scorecard.md'],
    dependencies: [
      'quality-metrics',
      'bundle-risk-ledger',
      'legacy-bridge',
      'compatibility-governance',
      'legacy-retirement-debt',
      'compatibility-import-governance',
      'critical-coverage',
      'operational-health',
      'system-confidence',
      'release-confidence-matrix',
      'technical-ownership-map',
      'guardrail-governance',
    ],
  }),
};

export const getEvidenceNode = id => EVIDENCE_DEPENDENCY_GRAPH[id] || null;

export const getEvidenceReportDependencies = id => getEvidenceNode(id)?.dependencies || [];

export const getEvidenceReportArtifacts = id => getEvidenceNode(id)?.artifacts || [];

export const getEvidenceReportCommand = id => getEvidenceNode(id)?.command || '';

export const resolveEvidenceDependencyFiles = dependency => {
  const node = getEvidenceNode(dependency);
  return node ? node.artifacts : [dependency];
};

const appendUnique = (target, values) => {
  for (const value of values) {
    if (value && !target.includes(value)) {
      target.push(value);
    }
  }
};

export const getEvidenceReportDependencyFiles = (id, { transitive = true } = {}) => {
  const files = [];
  const visitedNodes = new Set();

  const visitDependency = dependency => {
    const node = getEvidenceNode(dependency);
    if (!node) {
      appendUnique(files, [dependency]);
      return;
    }

    appendUnique(files, node.artifacts);
    if (!transitive || visitedNodes.has(dependency)) {
      return;
    }

    visitedNodes.add(dependency);
    for (const childDependency of node.dependencies || []) {
      visitDependency(childDependency);
    }
  };

  for (const dependency of getEvidenceReportDependencies(id)) {
    visitDependency(dependency);
  }

  return files;
};
