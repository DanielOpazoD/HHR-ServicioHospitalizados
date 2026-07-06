# Unit Shard Runtime Profile

- Generated: 2026-07-06T20:14:49.201Z
- Git SHA: `93051e36`
- Worktree dirty: `false`
- Files: 1403
- Shards: 4
- Spread: 0.2% (tolerance 25%)
- Per-file overhead: 0.1s
- CI calibration factor: 3.30x
- CI calibrated estimated total: 833.1s

## Shard Balance

| Shard | Files | Estimated Duration | Top files |
| ---: | ---: | ---: | --- |
| 1 | 414 | 63.1s / CI 208.4s | `src/tests/features/prescriptions/PrescriptionBedGridView.test.tsx`<br>`src/tests/services/storage/syncQueueService.test.ts`<br>`src/tests/services/dailyRecordRepository.test.ts`<br>`src/tests/components/layout/date-strip/MedicalIndicationsQuickAction.test.tsx` |
| 2 | 327 | 63.0s / CI 208.0s | `src/tests/services/terminology/cie10AISearch.test.ts`<br>`src/tests/services/ai/aiRequestManager.test.ts`<br>`src/tests/components/DemographicsModal.test.tsx`<br>`src/tests/views/census/DischargeRow.test.tsx` |
| 3 | 329 | 63.1s / CI 208.4s | `src/tests/build/reportFreshness.test.ts`<br>`src/tests/services/storage/indexedDBService.localReset.test.ts`<br>`src/tests/hooks/laboratory/useLabViewer.test.ts`<br>`src/tests/hooks/useDailyRecordSyncQuery.test.tsx` |
| 4 | 333 | 63.1s / CI 208.4s | `src/tests/integration/concurrency.test.tsx`<br>`src/tests/services/laboratory/syslabService.test.ts`<br>`src/tests/hooks/usePatientAutocomplete.test.ts`<br>`src/tests/hooks/useDailyRecord.census-action-matrix.test.tsx` |

## Slowest Files

| File | Group | Estimated Duration |
| --- | --- | ---: |
| `src/tests/services/terminology/cie10AISearch.test.ts` | unit-general | 4.6s |
| `src/tests/build/reportFreshness.test.ts` | governance | 3.7s |
| `src/tests/integration/concurrency.test.tsx` | ui-components | 2.2s |
| `src/tests/services/laboratory/syslabService.test.ts` | unit-general | 2.1s |
| `src/tests/services/storage/indexedDBService.localReset.test.ts` | unit-general | 1.7s |
| `src/tests/hooks/usePatientAutocomplete.test.ts` | unit-general | 1.6s |
| `src/tests/services/ai/aiRequestManager.test.ts` | unit-general | 1.6s |
| `src/tests/hooks/laboratory/useLabViewer.test.ts` | unit-general | 1.4s |
| `src/tests/hooks/useDailyRecord.census-action-matrix.test.tsx` | ui-components | 1.3s |
| `src/tests/components/DemographicsModal.test.tsx` | ui-components | 1.3s |
| `src/tests/hooks/useDailyRecordSyncQuery.test.tsx` | storage-sync | 1.3s |
| `src/tests/services/utils/errorService.test.ts` | unit-general | 1.2s |
| `src/tests/views/census/DischargeRow.test.tsx` | census | 1.2s |
| `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.test.tsx` | ui-components | 1.1s |
| `src/tests/functions/prescriptionAccessFunctions.test.ts` | unit-general | 1.1s |
| `src/tests/integration/daily-record-sync.test.tsx` | ui-components | 1.1s |
| `src/tests/features/clinical-documents/ClinicalDocumentSheet.indications.test.tsx` | ui-components | 1.1s |
| `src/tests/build/testRuntimeGovernanceSupport.test.ts` | governance | 1.1s |
| `src/tests/views/handoff/HandoffView.medical.test.tsx` | handoff | 1.1s |
| `src/tests/hooks/useAuditData.test.ts` | audit-observability | 1.0s |

## Functional Groups

| Group | Files | Estimated Duration |
| --- | ---: | ---: |
| unit-general | 505 | 77.1s |
| ui-components | 204 | 63.7s |
| census | 398 | 59.5s |
| governance | 69 | 14.7s |
| audit-observability | 66 | 11.8s |
| handoff | 71 | 10.9s |
| storage-sync | 56 | 10.6s |
| repositories | 34 | 4.1s |

## Recommendation

unit shard balance is within 25% tolerance; keep current generated assignment.

