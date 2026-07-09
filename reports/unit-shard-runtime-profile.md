# Unit Shard Runtime Profile

- Generated: 2026-07-09T05:51:44.843Z
- Git SHA: `ab68e300`
- Worktree dirty: `false`
- Files: 1404
- Shards: 4
- Spread: 0.1% (tolerance 25%)
- Per-file overhead: 0.1s
- CI calibration factor: 3.30x
- CI calibrated estimated total: 1565.2s

## Shard Balance

| Shard | Files | Estimated Duration | Top files |
| ---: | ---: | ---: | --- |
| 1 | 414 | 118.5s / CI 391.1s | `src/tests/build/testRuntimeGovernanceSupport.test.ts`<br>`src/tests/components/layout/date-strip/MedicalIndicationsQuickAction.test.tsx`<br>`src/tests/features/census/components/patient-row/UpcChecklistPanel.test.tsx`<br>`src/tests/components/laboratory/LabViewerComparisonTable.test.tsx` |
| 2 | 326 | 118.5s / CI 391.1s | `src/tests/build/reportFreshness.test.ts`<br>`src/tests/views/handoff/HandoffView.medical.test.tsx`<br>`src/tests/functions/prescriptionAccessFunctions.test.ts`<br>`src/tests/security/clinicalDocumentsImportGovernanceStatic.test.ts` |
| 3 | 335 | 118.6s / CI 391.5s | `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.test.tsx`<br>`src/tests/components/DemographicsModal.test.tsx`<br>`src/tests/features/clinical-documents/ClinicalDocumentSheet.indications.test.tsx`<br>`src/tests/features/prescriptions/PrescriptionBedGridView.test.tsx` |
| 4 | 329 | 118.6s / CI 391.5s | `src/tests/features/admin/SystemHealthDashboard.test.tsx`<br>`src/tests/services/terminology/cie10AISearch.test.ts`<br>`src/tests/components/MoveCopyModal.test.tsx`<br>`src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.behavior.test.tsx` |

## Slowest Files

| File | Group | Estimated Duration |
| --- | --- | ---: |
| `src/tests/build/reportFreshness.test.ts` | governance | 13.4s |
| `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.test.tsx` | ui-components | 6.9s |
| `src/tests/features/admin/SystemHealthDashboard.test.tsx` | ui-components | 5.3s |
| `src/tests/services/terminology/cie10AISearch.test.ts` | unit-general | 4.6s |
| `src/tests/components/DemographicsModal.test.tsx` | ui-components | 4.1s |
| `src/tests/components/MoveCopyModal.test.tsx` | ui-components | 4.0s |
| `src/tests/features/clinical-documents/ClinicalDocumentSheet.indications.test.tsx` | ui-components | 3.9s |
| `src/tests/views/handoff/HandoffView.medical.test.tsx` | handoff | 3.6s |
| `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.behavior.test.tsx` | ui-components | 3.5s |
| `src/tests/features/prescriptions/PrescriptionBedGridView.test.tsx` | ui-components | 3.1s |
| `src/tests/build/testRuntimeGovernanceSupport.test.ts` | governance | 2.9s |
| `src/tests/functions/prescriptionAccessFunctions.test.ts` | unit-general | 2.8s |
| `src/tests/services/storage/syncQueueLoad.test.ts` | storage-sync | 2.7s |
| `src/tests/services/storage/syncQueueService.test.ts` | storage-sync | 2.6s |
| `src/tests/components/layout/date-strip/MedicalIndicationsQuickAction.test.tsx` | ui-components | 2.5s |
| `src/tests/security/clinicalDocumentsImportGovernanceStatic.test.ts` | governance | 2.4s |
| `src/tests/features/clinical-documents/ClinicalDocumentSheet.test.tsx` | ui-components | 2.4s |
| `src/tests/features/clinical-documents/ClinicalDocumentFormattingToolbar.test.tsx` | ui-components | 2.3s |
| `src/tests/features/census/components/patient-row/UpcChecklistPanel.test.tsx` | census | 2.2s |
| `src/tests/integration/concurrency.test.tsx` | ui-components | 2.2s |

## Functional Groups

| Group | Files | Estimated Duration |
| --- | ---: | ---: |
| ui-components | 204 | 167.9s |
| unit-general | 505 | 109.3s |
| census | 398 | 95.8s |
| governance | 70 | 35.9s |
| handoff | 71 | 20.7s |
| audit-observability | 66 | 20.0s |
| storage-sync | 56 | 18.7s |
| repositories | 34 | 6.0s |

## Recommendation

unit shard balance is within 25% tolerance; keep current generated assignment.

