# Sustainable Change Policy

Generated at: 2026-04-09T19:25:11.446Z
Version: 1

## Change Types

| Id                      | Gates                                    | Docs                                                                                           | Artifacts                                                           |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| safe_local_ui           | ci:inner-loop                            | docs/SAFE_CHANGE_CHECKLIST.md                                                                  |                                                                     |
| critical_runtime        | ci:merge-gate, test:release-confidence   | docs/CI_GATES_AND_FAILURE_RUNBOOKS.md, docs/ENGINEERING_DEFINITION_OF_DONE.md                  | reports/release-readiness-scorecard.md                              |
| firestore_release       | ci:release-gate, test:release-confidence | docs/FIREBASE_POLICY.md, docs/RUNBOOK_SYNC_RESILIENCE.md                                       | reports/release-readiness-scorecard.md                              |
| architecture_contracts  | check:quality, ci:merge-gate             | docs/architecture.md, docs/QUALITY_GUARDRAILS.md, docs/ENGINEERING_DEFINITION_OF_DONE.md       |                                                                     |
| foundations_convergence | check:repo-hygiene, lint, typecheck      | docs/FOUNDATION_TRACKER.md, docs/FOUNDATION_MAINTENANCE_CADENCE.md, docs/QUALITY_GUARDRAILS.md | reports/quality-metrics.md, reports/technical-execution-baseline.md |
| dependency_upgrade      | typecheck, lint, ci:merge-gate           | docs/SAFE_CHANGE_CHECKLIST.md, docs/QUALITY_GUARDRAILS.md                                      | reports/release-readiness-scorecard.md                              |

## Dependency Upgrades

- Required fields: owner, reason, targetVersion, riskLevel, rollbackPlan, verificationGate

## Guardrail Exceptions

- Required fields: owner, reason, closureCriteria, expiresAt, trackedIn
- Escalation gate: check:quality

## Definition Of Done

- Required checks: typecheck, lint, check:quality, build
- Required docs: docs/ENGINEERING_DEFINITION_OF_DONE.md, docs/SAFE_CHANGE_CHECKLIST.md
- Release scorecard: reports/release-readiness-scorecard.md
