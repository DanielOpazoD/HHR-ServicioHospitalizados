import { execSync } from 'node:child_process';

const runGitCommand = (root, command) =>
  execSync(command, { cwd: root, encoding: 'utf8' }).trimEnd();
// Tracked report files that `report:governance-snapshots` regenerates after
// the scorecard captures its `gitDirty` field. Excluding them from the dirty
// check prevents the scorecard from being flagged as stale just because a
// later step in the same pipeline rewrote these tracked files. Keep this
// list aligned with the tracked report artifacts that any CI flow rewrites
// before `check:report-freshness` runs.
const GENERATED_REPORT_STATUS_SUFFIXES = new Set([
  'reports/legacy-bridge-governance.json',
  'reports/legacy-bridge-governance.md',
  'reports/runtime-contracts.json',
  'reports/runtime-contracts.md',
]);

const normalizeGitStatusPath = statusLine => {
  const rawLine = String(statusLine || '').trimEnd();
  if (!rawLine.trim()) return '';

  const content = rawLine.length > 3 ? rawLine.slice(3).trim() : '';
  if (!content) return '';

  if (content.includes(' -> ')) {
    return content.split(' -> ').pop()?.trim() || '';
  }

  return content;
};

export const isIgnorableGeneratedReportStatusLine = statusLine => {
  const normalizedPath = normalizeGitStatusPath(statusLine);
  return GENERATED_REPORT_STATUS_SUFFIXES.has(normalizedPath);
};

export const hasMeaningfulWorktreeChanges = gitStatusOutput =>
  String(gitStatusOutput || '')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(Boolean)
    .some(line => !isIgnorableGeneratedReportStatusLine(line));

export const getGitSha = root => {
  try {
    return runGitCommand(root, 'git rev-parse --short HEAD');
  } catch {
    return 'unknown';
  }
};

export const getDirectMergeParentShas = root => {
  try {
    const [head, ...parents] = runGitCommand(
      root,
      'git rev-list --parents --abbrev-commit -n 1 HEAD'
    ).split(/\s+/);
    if (!head || parents.length < 2) {
      return [];
    }
    return parents;
  } catch {
    return [];
  }
};

export const isGitWorktreeDirty = root => {
  try {
    return hasMeaningfulWorktreeChanges(runGitCommand(root, 'git status --short'));
  } catch {
    return false;
  }
};

export const getGitReportState = root => ({
  gitSha: getGitSha(root),
  gitDirty: isGitWorktreeDirty(root),
});

export const formatWorktreeState = gitDirty => (gitDirty ? 'dirty' : 'clean');
