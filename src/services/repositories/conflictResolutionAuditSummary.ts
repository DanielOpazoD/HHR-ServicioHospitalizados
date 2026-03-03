import { ConflictResolutionTraceEntry } from '@/services/repositories/conflictResolutionTrace';
import {
  assessConflictResolutionTrace,
  ConflictResolutionAssessment,
} from '@/services/repositories/conflictResolutionAssessment';
import {
  classifyConflictChangedContexts,
  type ConflictDomainContext,
} from '@/services/repositories/conflictResolutionDomainPolicy';

export interface ConflictAuditSummary {
  changedPaths: string[];
  impactedContexts: ConflictDomainContext[];
  policyVersion: string;
  entryCount: number;
  strategyBreakdown: Record<string, number>;
  winnerBreakdown: Record<string, number>;
  reasonBreakdown: Record<string, number>;
  samplePaths: string[];
  assessment: ConflictResolutionAssessment;
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
  impactedContexts: classifyConflictChangedContexts(changedPaths),
  policyVersion,
  entryCount: traceEntries.length,
  strategyBreakdown: countBy(traceEntries.map(entry => entry.strategy)),
  winnerBreakdown: countBy(traceEntries.map(entry => entry.winner)),
  reasonBreakdown: countBy(traceEntries.map(entry => entry.reason)),
  samplePaths: Array.from(new Set(traceEntries.map(entry => entry.path))).slice(0, 20),
  assessment: assessConflictResolutionTrace(changedPaths, traceEntries),
});
