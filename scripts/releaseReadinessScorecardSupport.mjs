#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const readOptionalReport = (root, relativePath) => {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return readJson(absolutePath);
};

const statusFrom = (condition, okSummary, degradedSummary) => ({
  status: condition ? 'ok' : 'degraded',
  summary: condition ? okSummary : degradedSummary,
});

export const buildReleaseReadinessScorecard = root => {
  const sourceFiles = {
    qualityMetrics: 'reports/quality-metrics.json',
    systemConfidence: 'reports/system-confidence.json',
    operationalHealth: 'reports/operational-health.json',
    releaseConfidenceMatrix: 'reports/release-confidence-matrix.json',
    technicalOwnershipMap: 'reports/technical-ownership-map.json',
    guardrailGovernance: 'reports/guardrail-governance.json',
    compatibilityImportGovernance: 'reports/compatibility-import-governance.json',
  };

  const sources = Object.fromEntries(
    Object.entries(sourceFiles).map(([key, relativePath]) => [key, readOptionalReport(root, relativePath)])
  );
  const missingReports = Object.entries(sourceFiles)
    .filter(([key]) => sources[key] === null)
    .map(([, relativePath]) => relativePath);

  const indicators = [];

  const qualityMetrics = sources.qualityMetrics;
  if (qualityMetrics) {
    const structuralOk =
      qualityMetrics.moduleSize?.oversizedCount === 0 &&
      qualityMetrics.folderDependencyDebt?.violations === 0 &&
      qualityMetrics.typeSafety?.explicitAnySourceCount === 0;
    indicators.push({
      name: 'structural_quality',
      ...statusFrom(
        structuralOk,
        `oversized=${qualityMetrics.moduleSize?.oversizedCount ?? 'n/a'}, folderDebt=${qualityMetrics.folderDependencyDebt?.violations ?? 'n/a'}, sourceAny=${qualityMetrics.typeSafety?.explicitAnySourceCount ?? 'n/a'}`,
        `oversized=${qualityMetrics.moduleSize?.oversizedCount ?? 'n/a'}, folderDebt=${qualityMetrics.folderDependencyDebt?.violations ?? 'n/a'}, sourceAny=${qualityMetrics.typeSafety?.explicitAnySourceCount ?? 'n/a'}`
      ),
    });
  }

  const systemConfidence = sources.systemConfidence;
  if (systemConfidence) {
    const governanceOk =
      systemConfidence.overallStatus === 'ok' && Number(systemConfidence.knownFailures?.openCount || 0) === 0;
    indicators.push({
      name: 'system_confidence',
      ...statusFrom(
        governanceOk,
        `overall=${systemConfidence.overallStatus}, openKnownFailures=${systemConfidence.knownFailures?.openCount ?? 'n/a'}`,
        `overall=${systemConfidence.overallStatus}, openKnownFailures=${systemConfidence.knownFailures?.openCount ?? 'n/a'}`
      ),
    });
  }

  const operationalHealth = sources.operationalHealth;
  if (operationalHealth) {
    const buildAssets = Array.isArray(operationalHealth.buildAssets?.largestAssets)
      ? operationalHealth.buildAssets.largestAssets
      : [];
    const bundleOk = buildAssets.every(asset => asset?.status === 'ok');
    const flowOk = operationalHealth.flowPerformance?.status === 'passing';
    indicators.push({
      name: 'operational_readiness',
      ...statusFrom(
        flowOk && bundleOk,
        `flow=${operationalHealth.flowPerformance?.status ?? 'n/a'}, bundle=${bundleOk ? 'ok' : 'degraded'}`,
        `flow=${operationalHealth.flowPerformance?.status ?? 'n/a'}, bundle=${bundleOk ? 'ok' : 'degraded'}`
      ),
    });
  }

  const releaseConfidenceMatrix = sources.releaseConfidenceMatrix;
  if (releaseConfidenceMatrix) {
    const releaseConfidenceOk = releaseConfidenceMatrix.overall === 'ok';
    indicators.push({
      name: 'release_confidence',
      ...statusFrom(
        releaseConfidenceOk,
        `areas=${releaseConfidenceMatrix.counts?.areaCount ?? 'n/a'}, blockingMapped=${releaseConfidenceMatrix.blockingSteps?.mapped ?? 'n/a'}/${releaseConfidenceMatrix.counts?.blockingSteps ?? 'n/a'}`,
        `areas=${releaseConfidenceMatrix.counts?.areaCount ?? 'n/a'}, blockingMapped=${releaseConfidenceMatrix.blockingSteps?.mapped ?? 'n/a'}/${releaseConfidenceMatrix.counts?.blockingSteps ?? 'n/a'}`
      ),
    });
  }

  const technicalOwnershipMap = sources.technicalOwnershipMap;
  if (technicalOwnershipMap) {
    const ownershipOk = Number(technicalOwnershipMap.areaCount || 0) >= 7;
    indicators.push({
      name: 'ownership_governance',
      ...statusFrom(
        ownershipOk,
        `areas=${technicalOwnershipMap.areaCount ?? 'n/a'}`,
        `areas=${technicalOwnershipMap.areaCount ?? 'n/a'}`
      ),
    });
  }

  const guardrailGovernance = sources.guardrailGovernance;
  if (guardrailGovernance) {
    const guardrailOk =
      Number(guardrailGovernance.blockingTierCount || 0) >= 3 &&
      Number(guardrailGovernance.reportOnlyCount || 0) >= 1;
    indicators.push({
      name: 'guardrail_governance',
      ...statusFrom(
        guardrailOk,
        `blockingTiers=${guardrailGovernance.blockingTierCount ?? 'n/a'}, reportOnly=${guardrailGovernance.reportOnlyCount ?? 'n/a'}`,
        `blockingTiers=${guardrailGovernance.blockingTierCount ?? 'n/a'}, reportOnly=${guardrailGovernance.reportOnlyCount ?? 'n/a'}`
      ),
    });
  }

  const compatibilityImportGovernance = sources.compatibilityImportGovernance;
  if (compatibilityImportGovernance) {
    const compatibilityOk =
      Number(compatibilityImportGovernance.checkedEntries || 0) > 0 &&
      Number(compatibilityImportGovernance.issues?.length || 0) === 0;
    indicators.push({
      name: 'compatibility_governance',
      ...statusFrom(
        compatibilityOk,
        `restrictedEntries=${compatibilityImportGovernance.checkedEntries ?? 'n/a'}, unauthorizedImports=${compatibilityImportGovernance.issues?.length ?? 'n/a'}`,
        `restrictedEntries=${compatibilityImportGovernance.checkedEntries ?? 'n/a'}, unauthorizedImports=${compatibilityImportGovernance.issues?.length ?? 'n/a'}`
      ),
    });
  }

  const issues = [];
  if (missingReports.length > 0) {
    issues.push(`Missing source reports: ${missingReports.join(', ')}`);
  }

  for (const indicator of indicators) {
    if (indicator.status !== 'ok') {
      issues.push(`${indicator.name}: ${indicator.summary}`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: issues.length === 0 ? 'ok' : 'degraded',
    indicators,
    missingReports,
    sources: Object.fromEntries(
      Object.entries(sourceFiles).map(([key, relativePath]) => [
        key,
        {
          file: relativePath,
          generatedAt: sources[key]?.generatedAt || null,
        },
      ])
    ),
    issues,
  };
};

export const formatReleaseReadinessScorecardMarkdown = report => {
  const lines = [
    '# Release Readiness Scorecard',
    '',
    `Generated at: ${report.generatedAt}`,
    `Overall: ${report.overallStatus}`,
    '',
    '## Indicators',
    '',
  ];

  for (const indicator of report.indicators) {
    lines.push(`- \`${indicator.name}\`: ${indicator.status} (${indicator.summary})`);
  }

  lines.push('', '## Sources', '');
  for (const [key, source] of Object.entries(report.sources)) {
    lines.push(`- \`${key}\`: ${source.file} (${source.generatedAt || 'missing'})`);
  }

  if (report.issues.length > 0) {
    lines.push('', '## Issues', '');
    for (const issue of report.issues) {
      lines.push(`- ${issue}`);
    }
  }

  return lines.join('\n');
};
