# Sync Convergence Evidence

- Generated: 2026-07-03T04:31:28.285Z
- Git SHA: `6ad3da47`
- Worktree: `clean`
- Status: `ready`
- Checks: `13/13` passing

## Sections

| Section | Status | Checks |
| --- | --- | ---: |
| Post-merge convergence | OK | 4/4 |
| Authority replay traceability | OK | 4/4 |
| Conservative recovery readiness | OK | 5/5 |

## Post-merge convergence

- OK `diagnostic-status-contract`: The convergence diagnostic exposes the four operational states used by support.
  - Evidence: `src/services/observability/syncConvergenceDiagnostics.ts`
- OK `clinical-divergence-findings`: The diagnostic detects duplicate active patients, missing movements and divergent handoff.
  - Evidence: `src/services/observability/syncConvergenceDiagnostics.ts`
- OK `diagnostic-tests`: The diagnostic has focused tests for unsafe and recoverable divergence scenarios.
  - Evidence: `src/tests/services/observability/syncConvergenceDiagnostics.test.ts`
- OK `operational-panel`: System Health summarizes convergence state without requiring raw log expansion.
  - Evidence: `src/tests/features/admin/systemHealthSyncConvergencePanel.test.ts`

## Authority replay traceability

- OK `truth-selection-telemetry`: Sync writes emit an explicit truth-selection telemetry event.
  - Evidence: `src/services/storage/sync/syncQueueTelemetryController.ts`
- OK `anonymous-actor-context`: Operational snapshots preserve accepted versions and resolution while anonymizing client/tab identifiers.
  - Evidence: `src/services/storage/sync/syncQueueTaskFactory.ts`
- OK `transport-resolution-paths`: Remote sync transport classifies accepted, merged, blocked and already-applied outcomes.
  - Evidence: `src/services/storage/sync/firestoreSyncTransport.ts`
- OK `telemetry-tests`: Telemetry tests guard traceability and privacy posture.
  - Evidence: `src/tests/services/storage/syncQueueTelemetryController.test.ts`

## Conservative recovery readiness

- OK `planner-action-contract`: The recovery planner exposes explicit support actions without performing writes.
  - Evidence: `src/services/observability/syncRecoveryPlanner.ts`
- OK `planner-no-aggressive-writes`: The recovery planner remains a pure recommender and does not mutate Firestore or outbox state.
  - Evidence: `src/services/observability/syncRecoveryPlanner.ts`
- OK `auto-merge-invariant-gate`: Auto-merge evaluates post-merge invariants before queueing/auditing a recovered record.
  - Evidence: `src/services/repositories/dailyRecordConflictAutoMergeController.ts`
- OK `three-client-replay-coverage`: Replay tests cover stale restart convergence for movements, discharge/CMA and handoff data.
  - Evidence: `src/tests/services/storage/syncQueueMutationConflict.test.ts`
- OK `planner-tests`: Recovery planner tests cover retry, manual block and already-applied acknowledgement decisions.
  - Evidence: `src/tests/services/observability/syncRecoveryPlanner.test.ts`

## Validation Commands

- `npx vitest run src/tests/services/observability/syncConvergenceDiagnostics.test.ts src/tests/services/observability/syncRecoveryPlanner.test.ts`
- `npx vitest run src/tests/services/storage/syncQueueTelemetryController.test.ts src/tests/services/storage/syncQueueMutationConflict.test.ts`
- `npx vitest run src/tests/features/admin/systemHealthSyncConvergencePanel.test.ts src/tests/hooks/controllers/systemHealthReporterController.test.ts`
- `npm run check:sync-convergence-evidence`

