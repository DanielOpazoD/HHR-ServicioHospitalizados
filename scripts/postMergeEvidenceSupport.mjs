export const POST_MERGE_EVIDENCE_COMMANDS = [
  { name: 'quality-metrics', command: 'npm run report:quality-metrics' },
  { name: 'system-confidence', command: 'npm run report:system-confidence' },
  { name: 'operational-health', command: 'npm run report:operational-health' },
  { name: 'clinical-release-validation', command: 'npm run report:clinical-release-validation' },
  { name: 'clinical-release-signoff', command: 'npm run report:clinical-release-signoff' },
  { name: 'release-readiness-scorecard', command: 'npm run report:release-readiness-scorecard' },
  { name: 'maintenance-debt-scorecard', command: 'npm run report:maintenance-debt-scorecard' },
  { name: 'report-freshness-strict', command: 'npm run check:report-freshness:strict' },
];

const statusLabel = status => (status === 'passed' ? 'verde' : 'revisar');

export const buildPostMergeEvidenceSummary = ({ generatedAt, branch, commit, results }) => {
  const freshness = results.find(result => result.name === 'report-freshness-strict');
  const lines = [
    '# Evidencia post-merge',
    '',
    `Generado: ${generatedAt}`,
    `Rama: \`${branch}\``,
    `Commit: \`${commit}\``,
    `Freshness estricta: ${statusLabel(freshness?.status)}`,
    '',
    '| Bloque | Estado | Comando |',
    '| --- | --- | --- |',
  ];

  for (const result of results) {
    lines.push(`| ${result.name} | ${result.status} | \`${result.command}\` |`);
  }

  return `${lines.join('\n')}\n`;
};
