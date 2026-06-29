import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateAuditPolicy,
  parseAuditActions,
} from '../../../scripts/check-clinical-mutation-audit-policy.mjs';

const basePolicy = {
  failClosed: ['ACTION_A'],
  bestEffortObservable: [
    { action: 'ACTION_B', justification: 'urgent clinical flow, abort harms care' },
  ],
  exemptNonMutation: ['ACTION_C'],
};

describe('check-clinical-mutation-audit-policy', () => {
  describe('parseAuditActions', () => {
    it('extracts the union members', () => {
      const src = "export type AuditAction =\n  | 'PATIENT_ADMITTED'\n  | 'VIEW_PATIENT';\n";
      expect(parseAuditActions(src)).toEqual(['PATIENT_ADMITTED', 'VIEW_PATIENT']);
    });

    it('extracts members regardless of quote style or naming convention', () => {
      // The gate must not be bypassable by a future action that breaks the UPPER_SNAKE convention.
      const src = 'export type AuditAction =\n  | "PATIENT_ADMITTED"\n  | \'data_imported\';\n';
      expect(parseAuditActions(src)).toEqual(['PATIENT_ADMITTED', 'data_imported']);
    });

    it('returns null when the union is absent', () => {
      expect(parseAuditActions('export type Something = string;')).toBeNull();
    });
  });

  describe('evaluateAuditPolicy', () => {
    it('passes when every action is classified exactly once', () => {
      expect(
        evaluateAuditPolicy({ actions: ['ACTION_A', 'ACTION_B', 'ACTION_C'], policy: basePolicy })
      ).toEqual([]);
    });

    it('fails on an unclassified action (forces a posture decision)', () => {
      const errors = evaluateAuditPolicy({
        actions: ['ACTION_A', 'ACTION_B', 'ACTION_C', 'ACTION_NEW'],
        policy: basePolicy,
      });
      expect(errors.join('\n')).toContain('ACTION_NEW');
    });

    it('fails when an action is declared in two buckets', () => {
      const errors = evaluateAuditPolicy({
        actions: ['ACTION_A', 'ACTION_B', 'ACTION_C'],
        policy: { ...basePolicy, exemptNonMutation: ['ACTION_C', 'ACTION_A'] },
      });
      expect(errors.join('\n')).toContain('two buckets');
    });

    it('fails when a best-effort action lacks a real justification', () => {
      const errors = evaluateAuditPolicy({
        actions: ['ACTION_A', 'ACTION_B', 'ACTION_C'],
        policy: {
          ...basePolicy,
          bestEffortObservable: [{ action: 'ACTION_B', justification: 'x' }],
        },
      });
      expect(errors.join('\n')).toContain('justification');
    });

    it('fails on a stale policy entry not in the union', () => {
      const errors = evaluateAuditPolicy({ actions: ['ACTION_A', 'ACTION_C'], policy: basePolicy });
      expect(errors.join('\n')).toContain('stale');
    });
  });

  it('the committed registry classifies every real AuditAction (no drift)', () => {
    const actions = parseAuditActions(
      fs.readFileSync(path.join(process.cwd(), 'src/types/auditActionTypes.ts'), 'utf8')
    );
    const policy = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'scripts/clinical-mutation-audit-policy.json'),
        'utf8'
      )
    );
    expect(evaluateAuditPolicy({ actions, policy })).toEqual([]);
  });
});
