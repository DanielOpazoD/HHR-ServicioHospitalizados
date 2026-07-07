# Unit Shard Runtime Profile

- Generated: 2026-07-07T00:38:20.525Z
- Git SHA: `e99a9a2e`
- Worktree dirty: `false`
- Files: 1403
- Shards: 4
- Spread: 0.1% (tolerance 25%)
- Per-file overhead: 0.1s
- CI calibration factor: 3.30x
- CI calibrated estimated total: 1341.1s

## Shard Balance

| Shard | Files | Estimated Duration | Top files |
| ---: | ---: | ---: | --- |
| 1 | 326 | 101.6s / CI 335.2s | `src/tests/build/reportFreshness.test.ts`<br>`src/tests/components/MoveCopyModal.test.tsx`<br>`src/tests/services/storage/syncQueueLoad.test.ts`<br>`src/tests/features/clinical-documents/ClinicalDocumentSheet.test.tsx` |
| 2 | 416 | 101.7s / CI 335.5s | `src/tests/components/DemographicsModal.test.tsx`<br>`src/tests/services/storage/syncQueueService.test.ts`<br>`src/tests/services/dailyRecordRepository.test.ts`<br>`src/tests/integration/concurrency.test.tsx` |
| 3 | 327 | 101.6s / CI 335.2s | `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.test.tsx`<br>`src/tests/services/terminology/cie10AISearch.test.ts`<br>`src/tests/views/handoff/HandoffView.medical.test.tsx`<br>`src/tests/functions/prescriptionAccessFunctions.test.ts` |
| 4 | 334 | 101.6s / CI 335.2s | `src/tests/features/admin/SystemHealthDashboard.test.tsx`<br>`src/tests/features/clinical-documents/ClinicalDocumentSheet.indications.test.tsx`<br>`src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.behavior.test.tsx`<br>`src/tests/features/prescriptions/PrescriptionBedGridView.test.tsx` |

## Slowest Files

| File | Group | Estimated Duration |
| --- | --- | ---: |
| `src/tests/build/reportFreshness.test.ts` | governance | 15.0s |
| `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.test.tsx` | ui-components | 8.2s |
| `src/tests/features/admin/SystemHealthDashboard.test.tsx` | ui-components | 6.6s |
| `src/tests/features/clinical-documents/ClinicalDocumentSheet.indications.test.tsx` | ui-components | 4.8s |
| `src/tests/services/terminology/cie10AISearch.test.ts` | unit-general | 4.6s |
| `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.behavior.test.tsx` | ui-components | 4.5s |
| `src/tests/views/handoff/HandoffView.medical.test.tsx` | handoff | 4.4s |
| `src/tests/components/DemographicsModal.test.tsx` | ui-components | 4.2s |
| `src/tests/components/MoveCopyModal.test.tsx` | ui-components | 3.5s |
| `src/tests/features/prescriptions/PrescriptionBedGridView.test.tsx` | ui-components | 3.4s |
| `src/tests/functions/prescriptionAccessFunctions.test.ts` | unit-general | 3.3s |
| `src/tests/services/storage/syncQueueService.test.ts` | storage-sync | 3.2s |
| `src/tests/services/storage/syncQueueLoad.test.ts` | storage-sync | 3.2s |
| `src/tests/features/clinical-documents/ClinicalDocumentFormattingToolbar.test.tsx` | ui-components | 2.5s |
| `src/tests/components/laboratory/LabViewerComparisonTable.test.tsx` | ui-components | 2.4s |
| `src/tests/services/dailyRecordRepository.test.ts` | census | 2.4s |
| `src/tests/integration/concurrency.test.tsx` | ui-components | 2.2s |
| `src/tests/features/clinical-documents/ClinicalDocumentSheet.test.tsx` | ui-components | 2.2s |
| `src/tests/build/testRuntimeGovernanceSupport.test.ts` | governance | 2.2s |
| `src/tests/services/laboratory/syslabService.test.ts` | unit-general | 2.1s |

## Functional Groups

| Group | Files | Estimated Duration |
| --- | ---: | ---: |
| ui-components | 204 | 145.2s |
| unit-general | 505 | 88.0s |
| census | 398 | 80.3s |
| governance | 69 | 33.2s |
| handoff | 71 | 19.8s |
| audit-observability | 66 | 17.7s |
| storage-sync | 56 | 17.2s |
| repositories | 34 | 4.9s |

## Recommendation

unit shard balance is within 25% tolerance; keep current generated assignment.

