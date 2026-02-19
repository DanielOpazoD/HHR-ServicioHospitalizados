import { ConflictResolutionTraceEntry } from '@/services/repositories/conflictResolutionTrace';

export interface ConflictAuditSummary {
  changedPaths: string[];
  policyVersion: string;
  entryCount: number;
  strategyBreakdown: Record<string, number>;
  winnerBreakdown: Record<string, number>;
  reasonBreakdown: Record<string, number>;
  samplePaths: string[];
}

const countBy = (items: string[]): Record<string, number> =>
  items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});

export const buildConflictAuditSummary = (
  changedPaths: string[],
  policyVersion: string,
  traceEntries: ConflictResolutionTraceEntry[]
): ConflictAuditSummary => ({
  changedPaths,
  policyVersion,
  entryCount: traceEntries.length,
  strategyBreakdown: countBy(traceEntries.map(entry => entry.strategy)),
  winnerBreakdown: countBy(traceEntries.map(entry => entry.winner)),
  reasonBreakdown: countBy(traceEntries.map(entry => entry.reason)),
  samplePaths: Array.from(new Set(traceEntries.map(entry => entry.path))).slice(0, 20),
});
