# Runbook de Budgets Operativos

## Objetivo

Centralizar los thresholds monitorables y los reportes base para soporte e ingeniería.

Fuentes obligatorias:

- `reports/operational-health.md`
- `reports/legacy-bridge-governance.md`
- `docs/RUNBOOK_SYNC_RESILIENCE.md`
- `docs/RUNBOOK_SUPPORT_OPERATIONS.md`

## System Health

Estos budgets se derivan desde `src/services/admin/systemHealthOperationalBudgets.ts`.

| Threshold                           |  Valor |
| ----------------------------------- | -----: |
| `warningOldestPendingAgeMs`         | 300000 |
| `criticalOldestPendingAgeMs`        | 900000 |
| `warningRetryingSyncTasks`          |      1 |
| `criticalRetryingSyncTasks`         |      3 |
| `warningPendingMutations`           |      1 |
| `criticalPendingMutations`          |      8 |
| `warningLocalErrorCount`            |      1 |
| `criticalLocalErrorCount`           |     15 |
| `warningRepositoryWarningCount`     |      1 |
| `criticalRepositoryWarningCount`    |      5 |
| `warningSlowRepositoryOperationMs`  |    350 |
| `criticalSlowRepositoryOperationMs` |    800 |

Budget complementario:

- `PROLONGED_OFFLINE_USER_AGE_MS = 900000`

## Sync Queue

Budgets monitoreables desde `reports/operational-health.md`:

- tamaño de batch
- retries máximos
- delays base y máximos
- perfiles de recovery por contexto

Si estos valores cambian:

1. regenerar `reports/operational-health.md`
2. revisar `docs/RUNBOOK_SYNC_RESILIENCE.md`
3. correr `npm run check:operational-runbooks`

## Conflictos por Contexto

La clasificación vive en `conflictResolutionDomainPolicy.ts`.

Contextos que soporte debe reconocer:

- `clinical`
- `staffing`
- `movements`
- `handoff`
- `metadata`
- `unknown`

Cada contexto tiene acción asociada en `reports/operational-health.md`.

## Legacy Bridge

La política vigente se resume en `reports/legacy-bridge-governance.md`.

Controles mínimos:

1. no volver a habilitar hot path legacy
2. mantener entrypoints explícitas
3. observar fase de retiro antes de cualquier cambio operativo

## Local Persistence

Los budgets de degradación local se derivan desde `indexedDbCore.ts` y aparecen en `reports/operational-health.md`:

- open timeout
- delete timeout
- max background recovery attempts
- recovery retry delays

## Taxonomía Operativa Unificada

El contrato canónico vive en `src/services/observability/operationalRuntimeState.ts`.

Estados obligatorios para incidentes operativos:

- `retryable`: el flujo falló, pero el sistema puede reintentar sin intervención mayor.
- `recoverable`: el flujo falló, pero existe camino alternativo o recuperación guiada para el usuario.
- `degraded`: el flujo sigue operativo, pero con capacidad reducida o señal de riesgo.
- `blocked`: el flujo quedó detenido y requiere intervención técnica o corrección de datos/configuración.
- `unauthorized`: el bloqueo viene de permisos, roles o contexto de autenticación no válido.

Regla práctica:

1. no usar `failed` como lenguaje de negocio o soporte; ese estado queda como compatibilidad de telemetría
2. clasificar auth, sync, storage y repositorios con uno de los estados anteriores
3. si un incidente llega a `blocked` o `unauthorized`, debe tener runbook o owner claro

## Comandos

```bash
npm run report:legacy-bridge
npm run report:operational-health
npm run check:docs-drift
npm run check:operational-runbooks
```
