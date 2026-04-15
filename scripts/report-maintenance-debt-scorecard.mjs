import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports');
const JSON_OUTPUT = path.join(REPORTS_DIR, 'maintenance-debt-scorecard.json');
const MD_OUTPUT = path.join(REPORTS_DIR, 'maintenance-debt-scorecard.md');
const QUALITY_METRICS_JSON = path.join(REPORTS_DIR, 'quality-metrics.json');
const MODULE_ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'module-size-allowlist.json');
const HOOK_LIMITS_PATH = path.join(ROOT, 'scripts', 'hook-hotspots-limits.json');

const WATCHLIST_FILES = [
  'firestore.rules',
  'src/services/repositories/dailyRecordWriteSupport.ts',
  'src/hooks/useCensusEmailRecipientLists.ts',
  'src/hooks/useBedManagementReducer.ts',
  'src/features/handoff/components/HandoffRowCells.tsx',
  'src/features/laboratory/controllers/labAnalyticsController.ts',
];

const CHURN_PREFIXES = [
  'src/features/census/',
  'src/features/handoff/',
  'src/features/laboratory/',
  'src/services/repositories/',
  'src/hooks/',
];

const readJson = file =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;

const countLines = filePath => {
  const absolutePath = path.join(ROOT, filePath);
  if (!fs.existsSync(absolutePath)) {
    return 0;
  }
  return fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/).length;
};

const buildWatchlistRows = () =>
  WATCHLIST_FILES.map(file => ({
    file,
    lines: countLines(file),
  })).sort((a, b) => b.lines - a.lines);

const buildPendingHotspotRows = () => {
  const moduleConfig = readJson(MODULE_ALLOWLIST_PATH) ?? {};
  const hookConfig = readJson(HOOK_LIMITS_PATH) ?? {};
  const globalMax = typeof moduleConfig.globalMax === 'number' ? moduleConfig.globalMax : 400;
  const moduleAllowlist =
    moduleConfig.allowlist && typeof moduleConfig.allowlist === 'object' ? moduleConfig.allowlist : {};
  const hookFiles = hookConfig.files && typeof hookConfig.files === 'object' ? hookConfig.files : {};

  const entries = [
    ...Object.entries(moduleAllowlist).map(([file, limit]) => ({
      file,
      limit: typeof limit === 'number' ? limit : globalMax,
      lines: countLines(file),
      source: 'module-allowlist',
    })),
    ...Object.entries(hookFiles).map(([file, limit]) => ({
      file,
      limit: typeof limit === 'number' ? limit : globalMax,
      lines: countLines(file),
      source: 'hook-hotspot',
    })),
  ];

  return entries
    .filter(entry => entry.lines > entry.limit)
    .sort((a, b) => b.lines - a.lines);
};

const buildRecentChurnRows = () => {
  const logOutput = execSync('git log --since="30 days ago" --name-only --pretty=format:', {
    cwd: ROOT,
    encoding: 'utf8',
  });

  const touchedFiles = logOutput
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const churnRows = CHURN_PREFIXES.map(prefix => ({
    prefix,
    touches: touchedFiles.filter(file => file.startsWith(prefix)).length,
  })).sort((a, b) => b.touches - a.touches);

  return churnRows;
};

const qualityMetrics = readJson(QUALITY_METRICS_JSON);
const pendingHotspots = buildPendingHotspotRows();
const watchlist = buildWatchlistRows();
const churn = buildRecentChurnRows();

const payload = {
  generatedAt: new Date().toISOString(),
  gitSha: execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
  pendingHotspots,
  watchlist,
  tests: {
    flakeRiskFiles: qualityMetrics?.tests?.flakeRiskFiles ?? null,
    knownFailureEntries: qualityMetrics?.tests?.knownFailureEntries ?? null,
    openKnownFailureEntries: qualityMetrics?.tests?.openKnownFailureEntries ?? null,
  },
  firestoreRules: {
    lines: watchlist.find(entry => entry.file === 'firestore.rules')?.lines ?? 0,
  },
  recentChurn: churn,
};

const markdown = `# Maintenance Debt Scorecard

Generated at: ${payload.generatedAt}
Commit: ${payload.gitSha}

## Pending Hotspots

${
  pendingHotspots.length === 0
    ? '- None'
    : pendingHotspots
        .map(
          entry =>
            `- ${entry.file}: ${entry.lines} líneas (limit ${entry.limit}, source ${entry.source})`
        )
        .join('\n')
}

## Watchlist By Size

${watchlist.map(entry => `- ${entry.file}: ${entry.lines} líneas`).join('\n')}

## Test Stability Signals

- Flake-risk test files: ${payload.tests.flakeRiskFiles ?? 'n/a'}
- Known failure entries: ${payload.tests.knownFailureEntries ?? 'n/a'}
- Open known failure entries: ${payload.tests.openKnownFailureEntries ?? 'n/a'}

## Firestore Rules Growth

- firestore.rules: ${payload.firestoreRules.lines} líneas

## Recent Churn (30 Days)

${churn.map(entry => `- ${entry.prefix}: ${entry.touches} archivos tocados`).join('\n')}
`;

fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(MD_OUTPUT, `${markdown}\n`);

console.log(`Wrote ${path.relative(ROOT, JSON_OUTPUT)}`);
console.log(`Wrote ${path.relative(ROOT, MD_OUTPUT)}`);
