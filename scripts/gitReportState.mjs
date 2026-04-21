import { execSync } from 'node:child_process';

const runGitCommand = (root, command) =>
  execSync(command, { cwd: root, encoding: 'utf8' }).trimEnd();
const GENERATED_REPORT_STATUS_SUFFIXES = new Set([
  'reports/legacy-bridge-governance.json',
  'reports/legacy-bridge-governance.md',
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
