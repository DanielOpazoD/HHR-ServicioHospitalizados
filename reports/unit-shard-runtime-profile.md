# Unit Shard Runtime Profile

- Generated: 2026-07-06T04:06:33.558Z
- Git SHA: `858b467e`
- Worktree dirty: `false`
- Files: 1400
- Shards: 4
- Spread: 0.2% (tolerance 25%)
- Per-file overhead: 0.1s

## Shard Balance

| Shard | Files | Estimated Duration | Top files |
| ---: | ---: | ---: | --- |
| 1 | 412 | 66.7s | `src/tests/build/ciRuntimeTelemetrySupport.test.ts`<br>`src/tests/components/MoveCopyModal.test.tsx`<br>`src/tests/build/ciRuntimeTelemetryScripts.test.ts`<br>`src/tests/integration/masterIntegration.test.tsx` |
| 2 | 326 | 66.6s | `src/tests/build/reportFreshness.test.ts`<br>`src/tests/services/storage/indexedDBService.localReset.test.ts`<br>`src/tests/features/admin/SystemHealthDashboard.test.tsx`<br>`src/tests/hooks/useDailyRecord.census-action-matrix.test.tsx` |
| 3 | 328 | 66.7s | `src/tests/services/terminology/cie10AISearch.test.ts`<br>`src/tests/hooks/usePatientAutocomplete.test.ts`<br>`src/tests/hooks/laboratory/useLabViewer.test.ts`<br>`src/tests/hooks/useDailyRecordSyncQuery.test.tsx` |
| 4 | 334 | 66.7s | `src/tests/integration/concurrency.test.tsx`<br>`src/tests/services/laboratory/syslabService.test.ts`<br>`src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.test.tsx`<br>`src/tests/services/ai/aiRequestManager.test.ts` |

## Slowest Files

| File | Group | Estimated Duration |
| --- | --- | ---: |
| `src/tests/build/reportFreshness.test.ts` | governance | 5.7s |
| `src/tests/services/terminology/cie10AISearch.test.ts` | unit-general | 4.6s |
| `src/tests/integration/concurrency.test.tsx` | ui-components | 2.2s |
| `src/tests/services/laboratory/syslabService.test.ts` | unit-general | 2.1s |
| `src/tests/features/clinical-documents/ClinicalDocumentsWorkspace.test.tsx` | ui-components | 1.9s |
| `src/tests/hooks/usePatientAutocomplete.test.ts` | unit-general | 1.7s |
| `src/tests/services/storage/indexedDBService.localReset.test.ts` | unit-general | 1.7s |
| `src/tests/services/ai/aiRequestManager.test.ts` | unit-general | 1.6s |
| `src/tests/hooks/laboratory/useLabViewer.test.ts` | unit-general | 1.4s |
| `src/tests/features/admin/SystemHealthDashboard.test.tsx` | ui-components | 1.4s |
| `src/tests/hooks/useDailyRecordSyncQuery.test.tsx` | storage-sync | 1.4s |
| `src/tests/views/census/DischargeRow.test.tsx` | census | 1.3s |
| `src/tests/hooks/useDailyRecord.census-action-matrix.test.tsx` | ui-components | 1.3s |
| `src/tests/build/ciRiskPackMembershipSupport.test.ts` | governance | 1.3s |
| `src/tests/components/DemographicsModal.test.tsx` | ui-components | 1.2s |
| `src/tests/hooks/useAuditData.test.ts` | audit-observability | 1.2s |
| `src/tests/functions/prescriptionAccessFunctions.test.ts` | unit-general | 1.2s |
| `src/tests/build/testRuntimeGovernanceSupport.test.ts` | governance | 1.2s |
| `src/tests/services/utils/errorService.test.ts` | unit-general | 1.1s |
| `src/tests/build/ciRuntimeTelemetrySupport.test.ts` | governance | 1.1s |

## Functional Groups

| Group | Files | Estimated Duration |
| --- | ---: | ---: |
| unit-general | 505 | 79.5s |
| ui-components | 204 | 66.5s |
| census | 397 | 61.7s |
| governance | 68 | 19.8s |
| audit-observability | 66 | 12.6s |
| storage-sync | 55 | 11.3s |
| handoff | 71 | 10.9s |
| repositories | 34 | 4.3s |

## Recommendation

unit shard balance is within 25% tolerance; keep current generated assignment.

