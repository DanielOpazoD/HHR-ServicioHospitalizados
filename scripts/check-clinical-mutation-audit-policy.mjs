#!/usr/bin/env node
/**
 * Governance gate: every AuditAction must declare how its mutation is audited.
 *
 * Reads the AuditAction union (src/types/auditActionTypes.ts) and the declared policy
 * (scripts/clinical-mutation-audit-policy.json) and fails if any action is unclassified, declared
 * in more than one bucket, references a non-existent action, or is best-effort without a
 * justification. This makes "how is this clinical mutation audited" an explicit, reviewed decision
 * instead of an accident — a new clinical AuditAction cannot ship until its audit posture is
 * declared. See docs/CLINICAL_MUTATION_AUDIT_POLICY.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Parse the `'ACTION'` members out of the `export type AuditAction = ...` union. */
export const parseAuditActions = (typesSource) => {
  const unionMatch = typesSource.match(/export type AuditAction =([\s\S]*?);/);
  if (!unionMatch) return null;
  return [...unionMatch[1].matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]);
};

/**
 * Pure evaluator: given the action list and the policy object, return the list of violation
 * messages (empty array = OK). No IO, so it is unit-testable.
 */
export const evaluateAuditPolicy = ({ actions, policy }) => {
  const errors = [];
  const failClosed = policy.failClosed ?? [];
  const bestEffort = policy.bestEffortObservable ?? [];
  const exempt = policy.exemptNonMutation ?? [];
  const actionSet = new Set(actions);

  const seen = new Map();
  const classify = (action, bucket) => {
    if (typeof action !== 'string') {
      errors.push(`A ${bucket} entry has a non-string action: ${JSON.stringify(action)}`);
      return;
    }
    if (seen.has(action)) {
      errors.push(`"${action}" is classified in two buckets (${seen.get(action)} and ${bucket}).`);
      return;
    }
    seen.set(action, bucket);
  };
  failClosed.forEach((a) => classify(a, 'failClosed'));
  bestEffort.forEach((e) => classify(e?.action, 'bestEffortObservable'));
  exempt.forEach((a) => classify(a, 'exemptNonMutation'));

  bestEffort.forEach((e) => {
    if (typeof e?.justification !== 'string' || e.justification.trim().length < 12) {
      errors.push(
        `bestEffortObservable "${e?.action ?? '(missing action)'}" needs a non-trivial ` +
          '"justification" (why proceeding-on-audit-failure is acceptable for this mutation).'
      );
    }
  });

  const unclassified = actions.filter((a) => !seen.has(a));
  if (unclassified.length) {
    errors.push(
      'These AuditAction(s) are not declared in scripts/clinical-mutation-audit-policy.json:\n' +
        unclassified.map((a) => `  - ${a}`).join('\n') +
        '\nAdd each to failClosed, bestEffortObservable (with a justification), or exemptNonMutation.'
    );
  }

  for (const action of seen.keys()) {
    if (!actionSet.has(action)) {
      errors.push(`Policy declares "${action}", which is not in the AuditAction union (stale entry).`);
    }
  }

  return errors;
};

const runCli = () => {
  const root = process.cwd();
  const typesFile = path.join(root, 'src', 'types', 'auditActionTypes.ts');
  const policyFile = path.join(root, 'scripts', 'clinical-mutation-audit-policy.json');

  const fail = (msg) => {
    console.error(`\n[clinical-mutation-audit-policy] FAILED\n\n${msg}\n`);
    process.exit(1);
  };

  const actions = parseAuditActions(fs.readFileSync(typesFile, 'utf8'));
  if (!actions) fail('Could not locate the `export type AuditAction = ...` union in src/types/auditActionTypes.ts');
  if (actions.length === 0) fail('Parsed zero AuditAction members — the regex or the union changed.');

  let policy;
  try {
    policy = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
  } catch (error) {
    fail(`Could not read/parse scripts/clinical-mutation-audit-policy.json: ${error.message}`);
  }

  const errors = evaluateAuditPolicy({ actions, policy });
  if (errors.length) fail(errors.join('\n\n'));

  console.log(
    `[clinical-mutation-audit-policy] OK — ${actions.length} AuditAction(s) classified ` +
      `(${(policy.failClosed ?? []).length} fail-closed, ` +
      `${(policy.bestEffortObservable ?? []).length} best-effort-observable, ` +
      `${(policy.exemptNonMutation ?? []).length} exempt).`
  );
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli();
}
