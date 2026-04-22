# Architectural Hotspots

- Generated: 2026-04-22T04:12:20.505Z
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
| `src/shared/contracts/applicationOutcomeTypes.ts` | 0 | 55 | medium | 180 |
| `src/features/clinical-documents/domain/entities.ts` | 12 | 45 | high | 179 |
| `src/components/shared/BaseModal.tsx` | 7 | 46 | medium | 167 |
| `src/types/authRoleTypes.ts` | 1 | 49 | medium | 164 |
| `src/types/domain/dailyRecord.ts` | 8 | 40 | medium | 151 |
| `src/shared/runtime/browserWindowRuntime.ts` | 4 | 41 | medium | 146 |
| `src/constants/clinical.ts` | 6 | 39 | medium | 144 |
| `src/context/AuthContext.tsx` | 13 | 34 | medium | 143 |
| `src/utils/dateFormattingUtils.ts` | 2 | 41 | medium | 142 |
| `src/services/observability/operationalTelemetryOutcomeRecorder.ts` | 1 | 37 | high | 133 |
| `src/types/domain/laboratory.ts` | 8 | 34 | medium | 133 |
| `src/types/transfers.ts` | 6 | 35 | medium | 132 |
| `src/features/census/types/censusAccessProfile.ts` | 2 | 35 | high | 129 |
| `src/types/domain/patient.ts` | 7 | 33 | medium | 128 |
| `src/features/census/components/patient-row/patientRowDataContracts.ts` | 2 | 34 | high | 126 |
| `src/types/auditLogTypes.ts` | 1 | 36 | medium | 125 |
| `src/constants/beds.ts` | 4 | 33 | medium | 122 |
| `src/shared/contracts/applicationOutcomeFactories.ts` | 0 | 34 | medium | 117 |
| `src/services/repositories/dailyRecordWriteSupport.ts` | 45 | 2 | high | 116 |
| `src/features/census/components/patient-row/patientRowViewContracts.ts` | 23 | 16 | high | 114 |
| `src/context/DailyRecordContext.tsx` | 14 | 23 | medium | 112 |
| `src/services/storage/indexeddb/indexedDbCore.ts` | 25 | 14 | high | 112 |
| `src/utils/clinicalDayUtils.ts` | 4 | 29 | medium | 110 |
| `src/features/census/contracts/censusMovementContracts.ts` | 1 | 29 | high | 109 |
| `src/services/observability/operationalTelemetryRecorder.ts` | 1 | 29 | high | 109 |
| `src/services/repositories/repositoryConfig.ts` | 9 | 23 | high | 107 |
| `src/services/staff/dailyRecordStaffing.ts` | 12 | 21 | high | 107 |
| `src/shared/access/operationalAccessPolicy.ts` | 10 | 24 | medium | 107 |

