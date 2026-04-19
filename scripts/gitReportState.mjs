import { execSync } from 'node:child_process';

const runGitCommand = (root, command) => execSync(command, { cwd: root, encoding: 'utf8' }).trim();

export const getGitSha = root => {
  try {
    return runGitCommand(root, 'git rev-parse --short HEAD');
  } catch {
    return 'unknown';
  }
};

export const isGitWorktreeDirty = root => {
  try {
    return runGitCommand(root, 'git status --short').length > 0;
  } catch {
    return false;
  }
};

export const getGitReportState = root => ({
  gitSha: getGitSha(root),
  gitDirty: isGitWorktreeDirty(root),
});

export const formatWorktreeState = gitDirty => (gitDirty ? 'dirty' : 'clean');
