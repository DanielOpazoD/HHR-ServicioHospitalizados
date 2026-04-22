# Architectural Hotspots

- Generated: 2026-04-22T05:11:10.297Z
- Ranking formula: `churn*2 + inboundImports*3 + criticalityWeight*5`

## Interpretation

- Score alto = alto costo de cambio probable.
- Priorizar estos archivos para extraer contratos compartidos, read models o outcomes tipados.
- Cruzar este reporte con compatibilidad legacy y cobertura crítica antes de priorizar trabajo.

## Top Hotspots

| File | Churn | Inbound imports | Criticality | Score |
| --- | ---: | ---: | --- | ---: |
| `src/services/utils/loggerScope.ts` | 1 | 72 | high | 238 |
| `src/application/shared/dailyRecordCoreContracts.ts` | 1 | 64 | high | 214 |
| `src/shared/contracts/applicationOutcomeTypes.ts` | 1 | 55 | medium | 182 |
| `src/features/clinical-documents/domain/entities.ts` | 12 | 45 | high | 179 |
| `src/components/shared/BaseModal.tsx` | 8 | 46 | medium | 169 |
| `src/types/authRoleTypes.ts` | 1 | 49 | medium | 164 |
| `src/types/domain/dailyRecord.ts` | 8 | 41 | medium | 154 |
| `src/context/AuthContext.tsx` | 13 | 34 | medium | 143 |
| `src/services/observability/operationalTelemetryOutcomeRecorder.ts` | 1 | 37 | high | 133 |
| `src/shared/runtime/browserWindowRuntimeCore.ts` | 1 | 38 | medium | 131 |
| `src/features/census/types/censusAccessProfile.ts` | 2 | 35 | high | 129 |
| `src/constants/clinicalMovementConstants.ts` | 1 | 37 | medium | 128 |
| `src/types/domain/patient.ts` | 7 | 33 | medium | 128 |
| `src/features/census/components/patient-row/patientRowDataContracts.ts` | 2 | 34 | high | 126 |
| `src/types/auditLogTypes.ts` | 1 | 36 | medium | 125 |
| `src/constants/beds.ts` | 4 | 33 | medium | 122 |
| `src/shared/contracts/applicationOutcomeFactories.ts` | 1 | 34 | medium | 119 |
| `src/features/census/components/patient-row/patientRowViewContracts.ts` | 23 | 16 | high | 114 |
| `src/types/transferRequestTypes.ts` | 1 | 32 | medium | 113 |
| `src/context/DailyRecordContext.tsx` | 14 | 23 | medium | 112 |
| `src/services/storage/indexeddb/indexedDbCore.ts` | 25 | 14 | high | 112 |
| `src/services/repositories/dailyRecordWriteSupport.ts` | 45 | 0 | high | 110 |
| `src/utils/clinicalDayUtils.ts` | 4 | 29 | medium | 110 |
| `src/features/census/contracts/censusMovementContracts.ts` | 1 | 29 | high | 109 |
| `src/services/observability/operationalTelemetryRecorder.ts` | 1 | 29 | high | 109 |
| `src/services/repositories/repositoryConfig.ts` | 9 | 23 | high | 107 |
| `src/services/staff/dailyRecordStaffing.ts` | 12 | 21 | high | 107 |
| `src/shared/access/operationalAccessPolicy.ts` | 10 | 24 | medium | 107 |
| `src/types/domain/labExamTypes.ts` | 1 | 30 | medium | 107 |
| `src/features/census/types/censusActionTypes.ts` | 5 | 25 | high | 105 |

