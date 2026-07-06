# Test Runtime Governance

- Generated: 2026-07-06T19:58:33.221Z
- Git SHA: `29270f50`
- Worktree dirty: `true`
- PR critical path budget: 35.0m

## PR Blocking Suites

| Suite | Scripts | Budget | Reason |
| --- | --- | ---: | --- |
| Unit risk shards | `test:ci:unit:shard` | 13.0m | Broad unit/integration coverage remains PR-blocking but horizontally sharded. |
| Clinical sync simulator release gate | `test:clinical-sync-simulator` | 2.0m | Distributed clinical sync regressions must stay visible in PR CI. |
| Firestore rules and sync emulator | `test:rules:ci`<br>`test:emulator:sync:ci` | 4.0m | Security rules and sync emulator behavior protect production writes. |
| Critical browser flows | `test:e2e:critical:ci` | 8.0m | Critical user-visible clinical flows remain PR-blocking. |

## Nightly Suites

| Suite | Script | Budget | Reason |
| --- | --- | ---: | --- |
| Sync queue load budget | `test:sync-load` | 5.0m | Load behavior is valuable trend evidence but should not lengthen every PR. |
| Full release confidence pack | `test:release-confidence:full` | 20.0m | Full pack catches cross-surface drift on schedule/manual runs. |
| Clinical stability E2E | `test:e2e:clinical-stability:ci` | 20.0m | Long browser scenario suite belongs in nightly coverage, not the PR critical path. |

## Slow Runtime Signals

| Check | Group | Duration |
| --- | --- | ---: |
| `check:feature-public-api-boundary` | boundaries | 3.7s |
| `check:security` | security | 2.3s |
| `check:test-runtime-governance` | tests | 1.6s |
| `check:folder-dependencies` | boundaries | 1.6s |
| `check:unit-shard-balance` | tests | 1.5s |
| `check:repo-hygiene` | hygiene | 1.3s |
| `check:report-freshness` | reports | 1.2s |
| `check:firestore-runtime-boundary` | boundaries | 0.9s |

- Unit shard balance: 1403 files, 0.1% spread across 4 shard(s), tolerance 25%, per-file overhead 0.1s.

- CI observed unit shard runtime: no_observed_ci_data, 0/4 shard(s), 0% observed spread.
  - Advisory: No observed CI runtime data is available yet.

- CI runtime calibration: not_generated, factor 1.0x, calibrated ratio 0%, accuracy delta 0%.
  - Advisory: Generate ci-runtime-calibration-profile after observed CI runtime is available.

## Fixture Duplication Governance

- Max inline DailyRecord fixture lines: 80
- Preferred roots: `src/tests/support`, `src/tests/utils`, `src/tests/integration/setup.tsx`

| Watchlist | Preferred Home | Reason |
| --- | --- | --- |
| large-inline-daily-record | shared builders under src/tests/support or src/tests/utils | DailyRecord fixtures are expensive to maintain when copied across clinical tests. |
| browser-runtime-mock | src/tests/utils/browserWindowRuntimeMock.ts | Runtime adapter mocks should stay centralized to avoid subtle UI/runtime drift. |
| sync-client-scenario | src/tests/support/clinicalSyncSimulator | Multi-PC/replay cases should reuse the simulator harness rather than bespoke stale-client fixtures. |

## Fixture Duplication Signals

| Signal | Files | Examples | Preferred Home |
| --- | ---: | --- | --- |
| large-inline-daily-record | 130 | `src/tests/emulator/atomic-write-guards.emulator.test.ts`<br>`src/tests/emulator/cma-specialty-readback.emulator.test.ts`<br>`src/tests/emulator/conflict-version-recovery.emulator.test.ts`<br>`src/tests/emulator/daily-record-delete-failclosed.emulator.test.ts`<br>`src/tests/emulator/discharge-bed-consistency.emulator.test.ts` | shared DailyRecord builders under src/tests/support or src/tests/utils |
| browser-runtime-mock | 10 | `src/tests/components/BookmarkEditorModal.test.tsx`<br>`src/tests/components/DatabaseStatusBanner.test.tsx`<br>`src/tests/components/IEEHFormDialog.test.tsx`<br>`src/tests/components/StorageStatusBadge.test.tsx`<br>`src/tests/components/TransferDocumentPackageModal.test.tsx` | src/tests/utils/browserWindowRuntimeMock.ts |
| sync-client-scenario | 21 | `src/tests/emulator/sync-mutation-idempotency.emulator.test.ts`<br>`src/tests/functions/dailyRecordWriteAuthorityFunctions.test.ts`<br>`src/tests/services/dailyRecordRepository.test.ts`<br>`src/tests/services/repositories/DailyRecordRepository.persistence-and-copy.test.ts`<br>`src/tests/services/repositories/dailyRecordConflictAutoMergeController.test.ts` | src/tests/support/clinicalSyncSimulator |

