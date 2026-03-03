import { ConflictResolutionTraceEntry } from '@/services/repositories/conflictResolutionTrace';

const REMOTE_PROTECTED_REASONS = new Set([
  'root_remote_priority',
  'admin_remote_priority',
  'metadata_remote_priority',
]);
const LOCAL_DOMINANT_REASONS = new Set([
  'root_local_priority',
  'clinical_local_priority',
  'handoff_local_priority',
  'staffing_local_priority',
]);

export interface ConflictResolutionAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  reviewRecommended: boolean;
  reviewReasons: string[];
  localDominantPaths: string[];
  remoteProtectedPaths: string[];
}

const dedupe = (items: string[]): string[] => Array.from(new Set(items));

const isWildcard = (changedPaths: string[]): boolean =>
  changedPaths.length === 0 || changedPaths.includes('*');

const pathIsExplicitlyChanged = (path: string, changedPaths: string[]): boolean =>
  isWildcard(changedPaths) ||
  changedPaths.some(changedPath => path === changedPath || path.startsWith(`${changedPath}.`));

export const assessConflictResolutionTrace = (
  changedPaths: string[],
  traceEntries: ConflictResolutionTraceEntry[]
): ConflictResolutionAssessment => {
  const relevantEntries = traceEntries.filter(entry =>
    pathIsExplicitlyChanged(entry.path, changedPaths)
  );
  const remoteProtectedPaths = dedupe(
    relevantEntries
      .filter(entry => entry.winner === 'remote' && REMOTE_PROTECTED_REASONS.has(entry.reason))
      .map(entry => entry.path)
  );
  const localDominantPaths = dedupe(
    relevantEntries
      .filter(entry => entry.winner === 'local' && LOCAL_DOMINANT_REASONS.has(entry.reason))
      .map(entry => entry.path)
  );

  const reviewReasons: string[] = [];
  if (remoteProtectedPaths.length > 0) {
    reviewReasons.push('remote_protected_fields_preserved');
  }
  if (changedPaths.includes('*') && remoteProtectedPaths.length > 0) {
    reviewReasons.push('wildcard_merge_with_remote_protected_fields');
  }

  let riskLevel: ConflictResolutionAssessment['riskLevel'] = 'low';
  if (remoteProtectedPaths.length > 0) {
    riskLevel = changedPaths.includes('*') ? 'high' : 'medium';
  }

  return {
    riskLevel,
    reviewRecommended: reviewReasons.length > 0,
    reviewReasons,
    localDominantPaths,
    remoteProtectedPaths,
  };
};
