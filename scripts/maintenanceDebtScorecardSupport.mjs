const resolveWatchlistLimit = ({ file, hookLimits, moduleLimits }) => {
  if (typeof hookLimits[file] === 'number') {
    return { limit: hookLimits[file], limitSource: 'hook-hotspot' };
  }

  if (typeof moduleLimits[file] === 'number') {
    return { limit: moduleLimits[file], limitSource: 'module-allowlist' };
  }

  return { limit: null, limitSource: null };
};

export const buildMaintenanceDebtWatchlistRows = ({
  watchlistFiles,
  countLines,
  hookLimits,
  moduleLimits,
}) =>
  watchlistFiles
    .map(file => {
      const lines = countLines(file);
      const { limit, limitSource } = resolveWatchlistLimit({ file, hookLimits, moduleLimits });

      return {
        file,
        lines,
        limit,
        limitSource,
        remainingLines: typeof limit === 'number' ? limit - lines : null,
      };
    })
    .sort((a, b) => b.lines - a.lines);
