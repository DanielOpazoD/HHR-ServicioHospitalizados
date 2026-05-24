# Strict Local-Firebase Sync Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform local-Firebase synchronization into an explicitly guaranteed system: verifiable local persistence, transactional outbox, multitab leasing, remote revision writes, mutation-aware conflict handling, and race-condition tests.

**Architecture:** Improve the existing IndexedDB, sync queue, Firestore callable, and repository contracts instead of adding a parallel sync stack. Each block must preserve existing public APIs where possible, add stricter APIs for critical paths, and prove behavior with focused unit/integration tests before broad gates.

**Tech Stack:** TypeScript, React, Dexie/IndexedDB, Firebase Firestore/callable functions, Vitest, fake-indexeddb, Playwright/emulator tests where appropriate.

---

## Branch Scope

This branch is allowed to contain multiple commits. Each commit should close one guarantee or one testable support contract. It should not add new product features, screens, or workflow concepts beyond making existing sync states explicit.

The branch should avoid a single large rewrite. The desired final state is a strengthened version of the current architecture:

- local record writes report a typed result and cannot silently fail on critical write paths;
- record persistence and sync queue enqueue can be committed atomically for offline retry;
- sync workers claim tasks with a durable lease before transport execution;
- remote writes carry mutation identity, changed paths, client/tab IDs, and revision expectations;
- conflict handling preserves non-conflicting mutation intent and surfaces true conflicts;
- tests cover local failure, fallback mode, transaction aborts, duplicate multitab processing, lease expiry, revision mismatch, and patch conflict semantics.

## Execution Blocks

### Task 1: Baseline And Current Contract

**Files:**

- Create: `docs/superpowers/plans/2026-05-24-strict-local-firebase-sync-foundations.md`

- [ ] Run focused baseline checks:

```bash
npm run typecheck
vitest run src/tests/services/repositories/dailyRecordRemotePersistenceController.test.ts src/tests/services/storage/syncQueueService.test.ts src/tests/services/storage/indexedDBService.test.ts
```

- [ ] Commit the plan and any baseline notes.

```bash
git add docs/superpowers/plans/2026-05-24-strict-local-firebase-sync-foundations.md
git commit -m "docs: plan strict local firebase sync foundations"
```

### Task 2: Verifiable Local Persistence

**Files:**

- Modify: `src/services/storage/indexeddb/indexedDbRecordService.ts`
- Modify: `src/services/storage/indexedDBService.ts`
- Modify: `src/services/repositories/dailyRecordRemotePersistenceController.ts`
- Modify: `src/services/repositories/dailyRecordWriteState.ts`
- Test: `src/tests/services/storage/indexedDBService.test.ts`
- Test: `src/tests/services/repositories/dailyRecordRemotePersistenceController.test.ts`

- [ ] Add typed local write result APIs: `saveRecordStrict`, `saveRecordsStrict`, and `deleteRecordStrict`.
- [ ] Keep legacy `saveRecord`, `saveRecords`, and `deleteRecord` wrappers behavior-compatible.
- [ ] Make critical repository persistence call the strict API and return/block when local persistence fails.
- [ ] Add tests proving local write failure prevents remote write and fallback mode is reported as fallback, not silently treated as IndexedDB.
- [ ] Commit after focused tests pass.

### Task 3: Transactional Outbox

**Files:**

- Modify: `src/services/storage/syncQueueTypes.ts`
- Modify: `src/services/storage/sync/syncQueuePorts.ts`
- Modify: `src/services/storage/sync/dexieSyncQueueStore.ts`
- Modify: `src/services/storage/sync/syncQueueEngine.ts`
- Modify: `src/services/repositories/dailyRecordRemoteWriteController.ts`
- Test: `src/tests/services/storage/syncQueueService.test.ts`
- Test: `src/tests/services/repositories/dailyRecordRepositoryWriteService.test.ts`

- [ ] Add a store method that persists daily record and sync task in one Dexie transaction.
- [ ] Use it for retryable critical daily-record writes where the remote write is not the source of truth.
- [ ] Preserve queue backpressure and existing task reuse semantics.
- [ ] Add tests for transaction abort when either record write or queue enqueue fails.
- [ ] Commit after focused tests pass.

### Task 4: Multitab Claim And Lease

**Files:**

- Modify: `src/services/storage/syncQueueTypes.ts`
- Modify: `src/services/storage/sync/syncQueuePorts.ts`
- Modify: `src/services/storage/sync/dexieSyncQueueStore.ts`
- Modify: `src/services/storage/sync/syncQueueEngine.ts`
- Test: `src/tests/services/storage/syncQueueService.test.ts`

- [ ] Add lease fields: `leaseOwner`, `leaseUntil`, `attemptId`, and `processingStartedAt`.
- [ ] Replace read-then-mark processing with a transactional `claimReadyPending` method.
- [ ] Make expired `PROCESSING` leases reclaimable.
- [ ] Add tests proving concurrent claims are disjoint and expired leases are reclaimed.
- [ ] Commit after focused tests pass.

### Task 5: Revision-Aware Remote Writes

**Files:**

- Modify: `src/services/storage/syncQueueTypes.ts`
- Modify: `src/services/storage/firestore/firestoreRecordWrites.ts`
- Modify: `src/services/storage/firestore/dailyRecordAuthorityCallableClient.ts`
- Modify: `functions/lib/dailyRecordWriteAuthorityFunctions.js`
- Test: `src/tests/functions/dailyRecordWriteAuthorityFunctions.test.ts`
- Test: `src/tests/services/storage/firestoreRecordWritesAuthorityPatch.test.ts`
- Test: `src/tests/emulator/sync-concurrency.emulator.test.ts`

- [ ] Promote `baseRevision` into the sync task contract while preserving `expectedVersion`.
- [ ] Ensure callable writes reject stale base revision deterministically.
- [ ] Return conflict details that can be classified as revision mismatch.
- [ ] Add tests for two clients writing from the same revision: first succeeds, second conflicts.
- [ ] Commit after focused function and Firestore tests pass.

### Task 6: Mutation-Aware Conflict Handling

**Files:**

- Modify: `src/services/storage/sync/syncTaskContractPolicy.ts`
- Modify: `src/services/storage/sync/firestoreSyncTransport.ts`
- Modify: `src/services/repositories/conflictResolutionMatrix.ts`
- Modify: `src/services/repositories/conflictResolutionUtils.ts`
- Test: `src/tests/services/repositories/conflictResolutionMatrix.test.ts`
- Test: `src/tests/services/storage/syncQueueService.test.ts`

- [ ] Treat queued daily-record writes as mutations with `changedPaths`, not only as snapshots.
- [ ] Allow safe merge for non-overlapping changed paths.
- [ ] Classify same-path divergence as deterministic conflict.
- [ ] Add tests for non-conflicting patches surviving and same-path edits becoming conflicts.
- [ ] Commit after focused tests pass.

### Task 7: Cross-Tab And Operational Evidence

**Files:**

- Create: `src/services/storage/sync/syncBroadcastChannel.ts`
- Modify: `src/services/storage/indexeddb/indexedDbRecordEvents.ts`
- Modify: `src/services/storage/sync/publicSyncQueue.ts`
- Test: `src/tests/services/storage/syncBroadcastChannel.test.ts`
- Test: `src/tests/integration/multiTabRegression.test.ts`

- [ ] Add record/sync BroadcastChannel events with safe no-op fallback.
- [ ] Keep existing same-tab custom event behavior.
- [ ] Invalidate/read refresh where existing query controllers already listen to store changes.
- [ ] Add tests for no BroadcastChannel support and cross-tab event delivery.
- [ ] Commit after focused tests pass.

### Task 8: Final Gates

**Files:**

- Modify docs only if implementation changes require operational notes.

- [ ] Run targeted sync suite:

```bash
vitest run src/tests/services/repositories/dailyRecordRemotePersistenceController.test.ts src/tests/services/repositories/dailyRecordRepositoryWriteService.test.ts src/tests/services/storage/indexedDBService.test.ts src/tests/services/storage/syncQueueService.test.ts src/tests/services/storage/firestoreRecordWritesAuthorityPatch.test.ts src/tests/functions/dailyRecordWriteAuthorityFunctions.test.ts
```

- [ ] Run broader quality gate:

```bash
npm run typecheck
npm run lint -- --max-warnings 0
npm run check:quality
```

- [ ] Run emulator sync gate if local emulator tooling is healthy:

```bash
npm run test:emulator:sync:ci
```

- [ ] Produce final branch summary with commits, tests, known residual watchlist, and PR recommendation.
