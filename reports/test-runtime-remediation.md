# Test Runtime Remediation

- Generated: 2026-07-09T05:23:15.447Z
- Git SHA: `95b28181`
- Worktree dirty: `true`
- Baseline: PR171 post-merge baseline (`78adc3b5`)

## Fixture Signal Delta

| Signal | Baseline | Current | Delta | Required reduction | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| large-inline-daily-record | 130 | 115 | -15 | 10 | within_budget |
| sync-client-scenario | 21 | 15 | -6 | 4 | within_budget |

## Slowest Files

| Rank | File | Group | Estimated duration | In baseline top 10 |
| ---: | --- | --- | ---: | --- |
| 1 | `src/tests/build/reportFreshness.test.ts` | governance | 16.1s | yes |
| 2 | `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.test.tsx` | ui-components | 10.9s | yes |
| 3 | `src/tests/features/admin/SystemHealthDashboard.test.tsx` | ui-components | 5.4s | yes |
| 4 | `src/tests/components/PatientRow.layout-and-actions.test.tsx` | ui-components | 5.2s | yes |
| 5 | `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.behavior.test.tsx` | ui-components | 5.1s | yes |
| 6 | `src/tests/services/terminology/cie10AISearch.test.ts` | unit-general | 4.6s | yes |
| 7 | `src/tests/features/prescriptions/PrescriptionBedGridView.test.tsx` | ui-components | 4.5s | yes |
| 8 | `src/tests/functions/prescriptionAccessFunctions.test.ts` | unit-general | 4.4s | yes |
| 9 | `src/tests/views/handoff/HandoffView.medical.test.tsx` | handoff | 4.3s | yes |
| 10 | `src/tests/features/analytics/SpecialtyBreakdownTable.test.tsx` | ui-components | 4.2s | yes |
| 11 | `src/tests/build/testRuntimeGovernanceSupport.test.ts` | governance | 4.0s | no |
| 12 | `src/tests/features/clinical-documents/ClinicalDocumentSheet.indications.test.tsx` | ui-components | 3.8s | no |
| 13 | `src/tests/components/DemographicsModal.test.tsx` | ui-components | 3.6s | no |
| 14 | `src/tests/components/TransferDocumentPackageModal.test.tsx` | ui-components | 3.3s | no |
| 15 | `src/tests/services/dailyRecordRepository.test.ts` | census | 3.3s | no |
| 16 | `src/tests/services/storage/syncQueueLoad.test.ts` | storage-sync | 3.2s | no |
| 17 | `src/tests/components/MoveCopyModal.test.tsx` | ui-components | 3.0s | no |
| 18 | `src/tests/views/cudyr/CudyrView.test.tsx` | ui-components | 2.9s | no |
| 19 | `src/tests/features/census/FugaNotificationModal.test.tsx` | census | 2.9s | no |
| 20 | `src/tests/components/layout/date-strip/MedicalIndicationsQuickAction.test.tsx` | ui-components | 2.7s | no |

## Shard Balance

- Spread: 0.1%
- Budget: 25%
- Status: within_budget

| Shard | Files | Estimated | CI calibrated |
| ---: | ---: | ---: | ---: |
| 1 | 416 | 121.7s | 401.5s |
| 2 | 330 | 121.6s | 401.2s |
| 3 | 328 | 121.7s | 401.5s |
| 4 | 330 | 121.6s | 401.2s |

## Regression Budget

- Baseline CI-calibrated total: 1602.9s
- Current CI-calibrated total: 1605.5s
- Delta: 2.6s
- Regression: 0.2%
- Budget: 25%
- Status: within_budget

