# Architectural Hotspots

- Generated: 2026-04-26T16:23:49.940Z
- Ranking formula: `churn*2 + inboundImports*3 + criticalityWeight*5`

## Interpretation

- Score alto = alto costo de cambio probable.
- Priorizar score alto con acción `reduce-responsibility` o `protect-boundary`.
- Contratos estables y barrels pequeños son superficies sanas: proteger API antes que fragmentar.
- Cruzar este reporte con compatibilidad legacy y cobertura crítica antes de priorizar trabajo.

## Top Hotspots

| File | Lines | Churn | Inbound imports | Criticality | Role | Action | Score |
| --- | ---: | ---: | ---: | --- | --- | --- | ---: |
| `src/services/utils/loggerScope.ts` | 13 | 2 | 72 | high | implementation | protect-boundary | 240 |
| `src/application/shared/dailyRecordCoreContracts.ts` | 17 | 2 | 69 | high | contract | protect-api | 231 |
| `src/features/clinical-documents/domain/entities.ts` | 5 | 12 | 48 | high | barrel | watch-only | 188 |
| `src/shared/contracts/applicationOutcomeTypes.ts` | 59 | 2 | 56 | medium | contract | protect-api | 187 |
| `src/components/shared/BaseModal.tsx` | 39 | 10 | 43 | medium | implementation | protect-boundary | 164 |
| `src/types/authRoleTypes.ts` | 19 | 1 | 49 | medium | contract | protect-api | 164 |
| `src/context/AuthContext.tsx` | 163 | 15 | 38 | medium | orchestrator | protect-boundary | 159 |
| `src/types/domain/dailyRecord.ts` | 91 | 8 | 41 | medium | contract | protect-boundary | 154 |
| `src/services/observability/operationalTelemetryOutcomeRecorder.ts` | 78 | 2 | 38 | high | implementation | protect-boundary | 138 |
| `src/features/census/types/censusAccessProfile.ts` | 5 | 2 | 37 | high | contract | protect-api | 135 |
| `src/features/census/components/patient-row/patientRowDataContracts.ts` | 31 | 2 | 36 | high | contract | protect-api | 132 |
| `src/shared/runtime/browserWindowRuntimeCore.ts` | 66 | 1 | 38 | medium | implementation | protect-boundary | 131 |
| `src/constants/clinicalMovementConstants.ts` | 49 | 1 | 37 | medium | implementation | protect-boundary | 128 |
| `src/types/domain/patient.ts` | 131 | 7 | 33 | medium | contract | protect-boundary | 128 |
| `src/types/auditLogTypes.ts` | 70 | 1 | 36 | medium | contract | protect-api | 125 |
| `src/shared/contracts/applicationOutcomeFactories.ts` | 66 | 2 | 35 | medium | contract | protect-api | 124 |
| `src/constants/beds.ts` | 44 | 4 | 33 | medium | implementation | protect-boundary | 122 |
| `src/utils/clinicalDayUtils.ts` | 232 | 6 | 31 | medium | implementation | protect-boundary | 120 |
| `src/services/storage/indexeddb/indexedDbCore.ts` | 240 | 28 | 14 | high | implementation | reduce-responsibility | 118 |
| `src/features/census/components/patient-row/patientRowViewContracts.ts` | 13 | 24 | 16 | high | contract | reduce-responsibility | 116 |
| `src/context/DailyRecordContext.tsx` | 175 | 15 | 23 | medium | orchestrator | watch | 114 |
| `src/services/observability/operationalTelemetryRecorder.ts` | 68 | 2 | 30 | high | implementation | protect-boundary | 114 |
| `src/types/transferRequestTypes.ts` | 91 | 1 | 32 | medium | contract | protect-api | 113 |
| `src/context/UIContext.tsx` | 144 | 8 | 27 | medium | orchestrator | watch | 112 |
| `src/services/repositories/dailyRecordWriteSupport.ts` | 3 | 46 | 0 | high | barrel | watch-only | 112 |
| `src/types/domain/labExamTypes.ts` | 52 | 1 | 31 | medium | contract | protect-api | 110 |
| `src/features/census/contracts/censusMovementContracts.ts` | 14 | 1 | 29 | high | contract | protect-api | 109 |
| `src/hooks/contracts/patientHookContracts.ts` | 8 | 3 | 29 | medium | contract | protect-api | 108 |
| `src/services/repositories/repositoryConfig.ts` | 164 | 9 | 23 | high | implementation | watch | 107 |
| `src/services/staff/dailyRecordStaffing.ts` | 238 | 12 | 21 | high | implementation | watch | 107 |

