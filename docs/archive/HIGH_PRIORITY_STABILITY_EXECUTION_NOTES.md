- High-priority stability execution notes

- [x] Recover `typecheck`, `lint`, `check:quality`, and `test:ci:unit`
- [x] Re-run `ci:merge-gate` to discover remaining release blockers
- [x] Fix `useAuthStateSessionSupport` type import regression blocking `typecheck`
- [x] Stabilize `HandoffRow` test copy drift in merge-gate/unit runs
- [x] Fix remaining `check:critical-coverage` failures in UI/tests with targeted coverage recovery
- [x] Re-run `ci:merge-gate` until fully green
- [x] Regenerate `reports/quality-metrics.md`
- [x] Regenerate `reports/release-readiness-scorecard.md`
- [x] Refactor `src/services/transfers/transferMutationsService.ts` without changing public API
- [x] Refactor `src/services/exporters/excel/censusHiddenSheetsRenderer.ts` without changing output
- [x] Consolidate fragile Firestore/runtime-contract test coverage around current repository contracts
- [x] Reduce expected logger/error noise in tests where it obscures real failures
- [x] Run final verification pass and update this document with completion state

- Verification outcomes
- [x] `npm run typecheck`
- [x] `npm run lint -- --max-warnings 0`
- [x] `npm run check:quality`
- [x] `npm run check:critical-coverage`
- [x] `npm run ci:merge-gate`

- Delivered implementation notes
- [x] Added critical-coverage recovery tests for census controllers, clinical-documents runtime/UI helpers, and transfer fallbacks
- [x] Regenerated readiness/governance reports to match current repository health
- [x] Extracted transfer mutation support helpers into `src/services/transfers/transferMutationSupport.ts`
- [x] Split hidden Excel sheet rendering into `censusHiddenSummarySheet.ts` and `censusHiddenUpcSheets.ts`
- [x] Reduced expected console noise in transfer mutation and clinical document PDF render tests
- [x] Final release gate passed with bundle-budget still green; near-limit warning remains on `vendor-excel-core`
