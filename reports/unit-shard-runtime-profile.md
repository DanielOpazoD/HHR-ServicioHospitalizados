# Unit Shard Runtime Profile

- Generated: 2026-07-07T00:31:46.746Z
- Git SHA: `066d34c8`
- Worktree dirty: `true`
- Files: 1403
- Shards: 4
- Spread: 0.1% (tolerance 25%)
- Per-file overhead: 0.1s
- CI calibration factor: 3.30x
- CI calibrated estimated total: 1696.3s

## Shard Balance

| Shard | Files | Estimated Duration | Top files |
| ---: | ---: | ---: | --- |
| 1 | 415 | 128.5s / CI 424.2s | `src/tests/build/testRuntimeGovernanceSupport.test.ts`<br>`src/tests/features/prescriptions/PrescriptionVisorView.test.tsx`<br>`src/tests/components/UserMenu.test.tsx`<br>`src/tests/build/runtimeAssetImportBoundary.test.ts` |
| 2 | 327 | 128.5s / CI 424.2s | `src/tests/build/reportFreshness.test.ts`<br>`src/tests/services/terminology/cie10AISearch.test.ts`<br>`src/tests/views/handoff/HandoffView.medical.test.tsx`<br>`src/tests/features/prescriptions/PrescriptionBedGridView.test.tsx` |
| 3 | 327 | 128.4s / CI 423.8s | `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.test.tsx`<br>`src/tests/components/MoveCopyModal.test.tsx`<br>`src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.behavior.test.tsx`<br>`src/tests/features/prescriptions/PrescriptionUploadForm.test.tsx` |
| 4 | 334 | 128.5s / CI 424.2s | `src/tests/features/admin/SystemHealthDashboard.test.tsx`<br>`src/tests/components/DemographicsModal.test.tsx`<br>`src/tests/views/handoff/HandoffRow.medical.test.tsx`<br>`src/tests/features/clinical-documents/ClinicalDocumentSheet.indications.test.tsx` |

## Slowest Files

| File | Group | Estimated Duration |
| --- | --- | ---: |
| `src/tests/build/reportFreshness.test.ts` | governance | 13.4s |
| `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.test.tsx` | ui-components | 7.3s |
| `src/tests/features/admin/SystemHealthDashboard.test.tsx` | ui-components | 7.2s |
| `src/tests/components/DemographicsModal.test.tsx` | ui-components | 6.1s |
| `src/tests/components/MoveCopyModal.test.tsx` | ui-components | 5.5s |
| `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.behavior.test.tsx` | ui-components | 5.2s |
| `src/tests/views/handoff/HandoffRow.medical.test.tsx` | handoff | 4.8s |
| `src/tests/services/terminology/cie10AISearch.test.ts` | unit-general | 4.6s |
| `src/tests/build/testRuntimeGovernanceSupport.test.ts` | governance | 4.3s |
| `src/tests/features/prescriptions/PrescriptionUploadForm.test.tsx` | ui-components | 4.2s |
| `src/tests/views/handoff/HandoffView.medical.test.tsx` | handoff | 4.1s |
| `src/tests/features/clinical-documents/ClinicalDocumentSheet.indications.test.tsx` | ui-components | 4.1s |
| `src/tests/features/prescriptions/PrescriptionVisorView.test.tsx` | ui-components | 4.0s |
| `src/tests/services/storage/syncQueueService.test.ts` | storage-sync | 3.8s |
| `src/tests/features/prescriptions/PrescriptionBedGridView.test.tsx` | ui-components | 3.6s |
| `src/tests/functions/prescriptionAccessFunctions.test.ts` | unit-general | 3.5s |
| `src/tests/components/UserMenu.test.tsx` | ui-components | 3.5s |
| `src/tests/features/prescriptions/PrescriptionReassignDialog.test.tsx` | ui-components | 3.4s |
| `src/tests/features/analytics/AnalyticsView.test.tsx` | ui-components | 3.4s |
| `src/tests/features/transfers/TransferFormModal.test.tsx` | ui-components | 3.1s |

## Functional Groups

| Group | Files | Estimated Duration |
| --- | ---: | ---: |
| ui-components | 204 | 207.6s |
| census | 398 | 98.9s |
| unit-general | 505 | 95.4s |
| governance | 69 | 38.1s |
| handoff | 71 | 25.6s |
| audit-observability | 66 | 24.6s |
| storage-sync | 56 | 18.4s |
| repositories | 34 | 5.5s |

## Recommendation

unit shard balance is within 25% tolerance; keep current generated assignment.

