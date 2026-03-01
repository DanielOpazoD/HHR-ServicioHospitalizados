import { describe, expect, it } from 'vitest';
import { buildConflictAuditSummary } from '@/services/repositories/conflictResolutionAuditSummary';

describe('conflictResolutionAuditSummary', () => {
  it('builds strategy/winner/reason breakdown for trace entries', () => {
    const summary = buildConflictAuditSummary(['beds.R1.pathology'], '2026-02-v2', [
      {
        path: 'beds.R1.pathology',
        strategy: 'scalar_policy',
        winner: 'local',
        reason: 'clinical_local_priority',
      },
      {
        path: 'beds.R1.location',
        strategy: 'scalar_policy',
        winner: 'remote',
        reason: 'admin_remote_priority',
      },
    ]);

    expect(summary.policyVersion).toBe('2026-02-v2');
    expect(summary.entryCount).toBe(2);
    expect(summary.strategyBreakdown.scalar_policy).toBe(2);
    expect(summary.winnerBreakdown.local).toBe(1);
    expect(summary.winnerBreakdown.remote).toBe(1);
    expect(summary.reasonBreakdown.clinical_local_priority).toBe(1);
    expect(summary.reasonBreakdown.admin_remote_priority).toBe(1);
    expect(summary.assessment.riskLevel).toBe('low');
    expect(summary.assessment.reviewRecommended).toBe(false);
  });

  it('flags wildcard merges that preserve remote-protected paths for review', () => {
    const summary = buildConflictAuditSummary(['*'], '2026-02-v2', [
      {
        path: 'beds.R1.pathology',
        strategy: 'scalar_policy',
        winner: 'local',
        reason: 'clinical_local_priority',
      },
      {
        path: 'beds.R1.location',
        strategy: 'scalar_policy',
        winner: 'remote',
        reason: 'admin_remote_priority',
      },
    ]);

    expect(summary.assessment.riskLevel).toBe('high');
    expect(summary.assessment.reviewRecommended).toBe(true);
    expect(summary.assessment.reviewReasons).toContain('remote_protected_fields_preserved');
    expect(summary.assessment.reviewReasons).toContain(
      'wildcard_merge_with_remote_protected_fields'
    );
    expect(summary.assessment.remoteProtectedPaths).toContain('beds.R1.location');
  });
});
