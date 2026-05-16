# Release Readiness Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five release-readiness blocks with small verified commits: fresh evidence, clinical sync safety, operational UX, security/rules hardening, and final release validation.

**Architecture:** Work stays on `codex/release-readiness-blocks`. Each block must end with a focused commit and a concrete verification set. Avoid broad rewrites; use existing report, guardrail, Playwright, repository, and observability patterns.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright, Firebase/Firestore rules, Netlify/Firebase functions, repo scripts in `package.json`.

---

### Task 1: Fresh Release Evidence Pack

**Files:**

- Modify generated reports under `reports/`
- Test: existing report freshness and release evidence scripts

- [ ] **Step 1: Regenerate release evidence reports**

Run:

```bash
npm run report:quality-metrics
npm run report:system-confidence
npm run report:operational-health
npm run report:release-confidence-matrix
npm run report:release-readiness-scorecard
npm run report:maintenance-debt-scorecard
```

Expected: each command exits `0` and report commits match current `HEAD`.

- [ ] **Step 2: Verify strict freshness and release evidence**

Run:

```bash
npm run check:report-freshness:strict
npm run check:release-evidence
npm run check:quality
```

Expected: all commands exit `0`.

- [ ] **Step 3: Commit**

```bash
git add reports
git commit -m "chore(release): refresh evidence pack"
```

### Task 2: Clinical Sync And Persistence Shield

**Files:**

- Inspect/modify likely seams: `src/services/repositories/dailyRecordRepositoryWriteService*.ts`, `src/services/repositories/dailyRecordPendingPatchController.ts`, `src/hooks/useDailyRecordQuery.ts`, `src/services/storage/**`
- Add or extend tests in `src/tests/services/repositories/` or `src/tests/hooks/controllers/`

- [ ] **Step 1: Identify one current high-risk sync path**

Run:

```bash
rg -n "pending|stale|writeAccepted|conflict|autoMerge|patch" src/services/repositories src/hooks src/tests/services/repositories src/tests/hooks/controllers
```

Expected: select one concrete clinical persistence path, not a broad rewrite.

- [ ] **Step 2: Add focused regression coverage**

Add a test that proves the selected path preserves the local clinical change across stale remote hydration, failed write, or retry state.

- [ ] **Step 3: Implement only the minimal code needed**

Keep the change inside the selected controller/repository seam.

- [ ] **Step 4: Verify**

Run the focused test, then:

```bash
npm run check:quality
npm run test:repository-compat
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "fix(sync): protect clinical census persistence"
```

### Task 3: Operational UX For Degraded States

**Files:**

- Inspect/modify likely seams: `src/services/observability/`, `src/app-shell/`, `src/features/census/`, `src/features/clinical-documents/`
- Add or extend tests in `src/tests/features/`, `src/tests/app-shell/`, or `src/tests/services/observability/`

- [ ] **Step 1: Choose one silent or ambiguous state**

Use current runtime contracts and tests to pick one user-visible ambiguity, such as sync retrying, permission denial, stale document state, or unavailable telemetry.

- [ ] **Step 2: Add UI/regression coverage**

Add a focused test proving the state is visible and actionable, without adding a new parallel workflow.

- [ ] **Step 3: Implement the smallest visible status improvement**

Use existing status/banner/presentation patterns.

- [ ] **Step 4: Verify**

Run the focused test, then:

```bash
npm run lint
npm run check:quality
PLAYWRIGHT_WEB_SERVER_PORT=4174 npm run test:e2e:clinical-visual-release
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add src e2e reports/e2e
git commit -m "feat(ops): surface clinical degraded states"
```

### Task 4: Security, Rules, And Dependency Risk Closure

**Files:**

- Inspect/modify likely seams: `package-lock.json`, `functions/package-lock.json`, `rules/firestore/*.rules`, `firestore.rules`, `scripts/check-dependency-vulnerabilities.mjs`
- Add or extend tests in `src/tests/security/` or `src/tests/build/`

- [ ] **Step 1: Re-run current dependency and rules gates**

Run:

```bash
npm run check:dependency-vulnerabilities
npm run check:security
npm run test:firestore:release:ci
```

Expected: identify whether remaining dependency risk is policy-accepted moderate debt or an actionable safe patch.

- [ ] **Step 2: Apply only safe dependency/rules changes**

Do not perform major Firebase/admin upgrades unless the command output proves they are required for high/critical closure.

- [ ] **Step 3: Verify**

Run:

```bash
npm run check:dependency-vulnerabilities
npm run check:security
npm run test:firestore:release:ci
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit**

```bash
git add package-lock.json functions/package-lock.json rules firestore.rules reports/security
git commit -m "chore(security): close release security gates"
```

### Task 5: Final Release Gate And Visual Closure

**Files:**

- Modify generated reports under `reports/`
- Modify docs only if release closure evidence needs an explicit note

- [ ] **Step 1: Run merge and release gates**

Run:

```bash
npm run ci:merge-gate
npm run ci:release-gate
```

Expected: both commands exit `0`.

- [ ] **Step 2: Confirm final visual/manual evidence**

Run:

```bash
PLAYWRIGHT_WEB_SERVER_PORT=4174 npm run test:e2e:clinical-visual-release
```

Expected: Playwright exits `0` and attaches current clinical surfaces.

- [ ] **Step 3: Refresh final reports after any generated evidence changes**

Run:

```bash
npm run check:release-evidence
git status --short
```

Expected: release evidence exits `0`; changed report files are reviewed.

- [ ] **Step 4: Commit**

```bash
git add reports docs
git commit -m "chore(release): close final release gate"
```
