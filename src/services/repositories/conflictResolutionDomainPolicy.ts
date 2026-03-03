export type ConflictDomainContext =
  | 'clinical'
  | 'staffing'
  | 'movements'
  | 'handoff'
  | 'metadata'
  | 'unknown';

const resolveContextForPath = (path: string): ConflictDomainContext => {
  if (path.startsWith('beds.')) return 'clinical';
  if (
    path.startsWith('nurses') ||
    path.startsWith('tens') ||
    path === 'activeExtraBeds' ||
    path.startsWith('activeExtraBeds.')
  ) {
    return 'staffing';
  }
  if (path.startsWith('discharges') || path.startsWith('transfers') || path.startsWith('cma')) {
    return 'movements';
  }
  if (path.toLowerCase().includes('handoff')) return 'handoff';
  if (
    path === 'date' ||
    path === 'lastUpdated' ||
    path === 'schemaVersion' ||
    path === 'dateTimestamp'
  ) {
    return 'metadata';
  }
  return 'unknown';
};

export const classifyConflictChangedContexts = (
  changedPaths: string[]
): ConflictDomainContext[] => {
  if (changedPaths.length === 0 || changedPaths.includes('*')) {
    return ['clinical', 'staffing', 'movements', 'handoff', 'metadata'];
  }

  return Array.from(new Set(changedPaths.map(resolveContextForPath)));
};
