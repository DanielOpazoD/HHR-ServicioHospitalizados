# Test Runtime Remediation

- Generated: 2026-07-09T05:53:10.677Z
- Git SHA: `9e02a373`
- Worktree dirty: `false`
- Baseline: PR171 post-merge baseline (`78adc3b5`)

## Fixture Signal Delta

| Signal | Baseline | Current | Delta | Required reduction | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| large-inline-daily-record | 130 | 115 | -15 | 10 | within_budget |
| sync-client-scenario | 21 | 15 | -6 | 4 | within_budget |

## Slowest Files

| Rank | File | Group | Estimated duration | In baseline top 10 |
| ---: | --- | --- | ---: | --- |
| 1 | `src/tests/build/reportFreshness.test.ts` | governance | 13.4s | yes |
| 2 | `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.test.tsx` | ui-components | 6.9s | yes |
| 3 | `src/tests/features/admin/SystemHealthDashboard.test.tsx` | ui-components | 5.3s | yes |
| 4 | `src/tests/services/terminology/cie10AISearch.test.ts` | unit-general | 4.6s | yes |
| 5 | `src/tests/components/DemographicsModal.test.tsx` | ui-components | 4.1s | no |
| 6 | `src/tests/components/MoveCopyModal.test.tsx` | ui-components | 4.0s | no |
| 7 | `src/tests/features/clinical-documents/ClinicalDocumentSheet.indications.test.tsx` | ui-components | 3.9s | no |
| 8 | `src/tests/views/handoff/HandoffView.medical.test.tsx` | handoff | 3.6s | yes |
| 9 | `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.behavior.test.tsx` | ui-components | 3.5s | yes |
| 10 | `src/tests/features/prescriptions/PrescriptionBedGridView.test.tsx` | ui-components | 3.1s | yes |
| 11 | `src/tests/build/testRuntimeGovernanceSupport.test.ts` | governance | 2.9s | no |
| 12 | `src/tests/functions/prescriptionAccessFunctions.test.ts` | unit-general | 2.8s | yes |
| 13 | `src/tests/services/storage/syncQueueLoad.test.ts` | storage-sync | 2.7s | no |
| 14 | `src/tests/services/storage/syncQueueService.test.ts` | storage-sync | 2.6s | no |
| 15 | `src/tests/components/layout/date-strip/MedicalIndicationsQuickAction.test.tsx` | ui-components | 2.5s | no |
| 16 | `src/tests/security/clinicalDocumentsImportGovernanceStatic.test.ts` | governance | 2.4s | no |
| 17 | `src/tests/features/clinical-documents/ClinicalDocumentSheet.test.tsx` | ui-components | 2.4s | no |
| 18 | `src/tests/features/clinical-documents/ClinicalDocumentFormattingToolbar.test.tsx` | ui-components | 2.3s | no |
| 19 | `src/tests/features/census/components/patient-row/UpcChecklistPanel.test.tsx` | census | 2.2s | no |
| 20 | `src/tests/integration/concurrency.test.tsx` | ui-components | 2.2s | no |

## Shard Balance

- Spread: 0.1%
- Budget: 25%
- Status: within_budget

| Shard | Files | Estimated | CI calibrated |
| ---: | ---: | ---: | ---: |
| 1 | 414 | 118.5s | 391.1s |
| 2 | 326 | 118.5s | 391.1s |
| 3 | 335 | 118.6s | 391.5s |
| 4 | 329 | 118.6s | 391.5s |

## Regression Budget

- Baseline CI-calibrated total: 1602.9s
- Current CI-calibrated total: 1565.2s
- Delta: -37.6s
- Regression: -2.3%
- Budget: 25%
- Status: within_budget

