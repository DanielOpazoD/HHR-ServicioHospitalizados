import type { DailyRecordPatch } from '@/types/domain/dailyRecord';

export type DailyRecordDomainContext =
  | 'clinical'
  | 'staffing'
  | 'movements'
  | 'handoff'
  | 'metadata'
  | 'unknown';

const resolveDomainContextForPath = (path: string): DailyRecordDomainContext => {
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

export const classifyDailyRecordPatchContexts = (
  patch: DailyRecordPatch
): DailyRecordDomainContext[] =>
  Array.from(new Set(Object.keys(patch).map(resolveDomainContextForPath).filter(Boolean)));

export const classifyDailyRecordSaveContexts = (): DailyRecordDomainContext[] => [
  'clinical',
  'staffing',
  'movements',
  'handoff',
  'metadata',
];
