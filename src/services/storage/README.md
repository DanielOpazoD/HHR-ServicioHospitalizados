# `src/services/storage`

## Propósito

Capa de persistencia concreta: IndexedDB, localStorage, Firestore bridge y sincronización.

## Entry points canónicos

| Path                                      | Uso soportado                                               |
| ----------------------------------------- | ----------------------------------------------------------- |
| `storage/firestore`                       | lectura/escritura remota de registros y catálogos           |
| `storage/sync`                            | cola, retry, métricas y telemetría de sincronización        |
| `storage/core`                            | disponibilidad de IndexedDB, fallback y mantenimiento/reset |
| `storage/records`                         | acceso directo al record store local                        |
| `storage/runtime`                         | bootstrap/bindings y política visible de fallback           |
| `storage/migration/legacyFirestoreBridge` | compatibilidad histórica explícita y controlada             |

Las fachadas `firestoreService.ts`, `syncQueueService.ts`, `index.ts` y `legacyFirebaseService.ts`
se mantienen solo como compatibilidad temporal.

## Mapa

| Path/Archivo                                  | Propósito                                                      |
| --------------------------------------------- | -------------------------------------------------------------- |
| `indexedDBService.ts`                         | API de alto nivel para IndexedDB                               |
| `localStorageService.ts`                      | Gateway legacy mínimo para records/nurses/maintenance          |
| `unifiedLocalService.ts`                      | Facade de compatibilidad local no-demo                         |
| `firestoreService.ts`                         | Fachada deprecated de compatibilidad hacia `storage/firestore` |
| `syncQueueService.ts`                         | Fachada deprecated de compatibilidad hacia `storage/sync`      |
| `syncQueueTypes.ts`                           | Tipos de cola de sincronización                                |
| `sync/`                                       | Engine, runtime, transport y store del outbox                  |
| `core/`                                       | Entry point público de disponibilidad y mantenimiento          |
| `records/`                                    | Entry point público del record store local                     |
| `runtime/`                                    | Entry point público de bootstrap y fallback UI                 |
| `migration/legacyFirestoreBridge.ts`          | Bridge canónico de migración Firestore legacy                  |
| `tableConfigService.ts`                       | Persistencia de configuración de tablas                        |
| `uiSettingsService.ts`                        | Persistencia de preferencias UI                                |
| `localpersistence/localPersistenceService.ts` | Fallback local unificado (records/settings)                    |
| `index.ts`                                    | Exports de storage                                             |
| `indexeddb/` / `localstorage/` / `firestore/` | Implementaciones más finas por backend                         |

`storage/firestore` es el entrypoint remoto soportado; `firestoreService.ts` queda como bridge deprecated.
La construcción de rangos mensuales y helpers de escritura sigue viviendo en
`firestore/firestoreQuerySupport.ts` y `firestore/firestoreWriteSupport.ts`.
`storage/sync` es la fuente soportada para telemetría (`getSyncQueueTelemetry()`), stats (`getSyncQueueStats()`) y operaciones recientes (`listRecentSyncQueueOperations()`).
La fachada pública vive en `sync/publicSyncQueue.ts`; `syncQueueService.ts` queda solo como compatibilidad deprecated.
El outbox ahora se arma sobre un engine con puertos (`sync/syncQueueEngine.ts`, `sync/syncQueuePorts.ts`) para separar runtime navegador, store Dexie y transporte Firestore.
`sync/syncDomainPolicy.ts` clasifica tareas por contexto (`clinical`, `staffing`, `movements`, `handoff`, `metadata`) para aplicar budgets de retry y métricas de conflicto más específicas.
`storage/index.ts` queda como barrel de compatibilidad mínima; nuevos imports deben ir a `storage/firestore`, `storage/sync`, `storage/core`, `storage/records` o `storage/runtime`.

## Estrategia

- Offline-first con IndexedDB.
- Fallback controlado en caso de fallo de DB local.
- Sincronización diferida con Firestore.
- No existe almacenamiento demo soportado en esta capa.
- La UI de fallback intenta primero una recuperación automática de sesión antes de mostrar avisos al usuario.
- Los hooks de estado de fallback pausan el polling cuando la pestaña está oculta para evitar trabajo innecesario.

## Compatibilidad

- `indexedDBService.ts` es la fachada principal para persistencia local real.
- `unifiedLocalService.ts` conserva compatibilidad útil para acceso local no-demo.
- `localStorageService.ts` sigue existiendo solo como gateway legacy mínimo y deprecated.
- `migration/legacyFirestoreBridge.ts` concentra la compatibilidad histórica de lectura desde rutas Firestore antiguas.
- `legacyFirebaseService.ts` queda como fachada deprecated detrás de ese bridge.
- `legacyFirebaseRecordService.ts` se mantiene como fachada pública interna para record reads, rangos, suscripciones y discovery, con módulos especializados por responsabilidad.
- La compatibilidad legacy ya no participa del camino caliente de `DailyRecord`; se importa
  explícitamente desde `legacyRecordBridgeService.ts` cuando se requiere migración controlada.
- Paths legacy todavía soportados para `DailyRecord`:
  - `hospitals/hanga_roa/dailyRecords/{date}`
  - `hospitals/hhr/dailyRecords/{date}`
  - `hospitals/hospital-hanga-roa/dailyRecords/{date}`
  - `dailyRecords/{date}`
  - `records/{date}`

## Recomendación

Cambios en esta capa requieren:

1. tests de servicios,
2. verificación de degradación/fallback,
3. revisión de impacto en `DailyRecordRepository`.
4. si tocan `sync/` o `firestore/`, actualizar `reports/operational-health.md`
5. mantener alineados `docs/RUNBOOK_SYNC_RESILIENCE.md`,
   `docs/RUNBOOK_OPERATIONAL_BUDGETS.md` y `npm run check:operational-runbooks`
   cuando cambien budgets, degradación local o criterios de alerta.
   y mantener `storage/firestore`/`storage/sync` como fachadas curadas.

## Contrato y límites

- `storage/firestore` no debe reabsorber helpers de rango, concurrencia o snapshots.
- `storage/sync` es el único punto de acceso soportado para telemetría, stats
  y operaciones recientes; la UI no debe leer Dexie directo para esta información.
- `sync/publicSyncQueue.ts` es la implementación canónica del outbox; `syncQueueService.ts`
  no debe recuperar lógica nueva.
- `storage/core` es el único punto de acceso soportado para fallback/reset desde UI y hooks.
- `storage/runtime` es el punto de acceso soportado para copy/UI de degradación y bootstrap IndexedDB.
- Si cambia la policy domain-aware de sync, deben actualizarse en conjunto:
  - `sync/syncDomainPolicy.ts`
  - `syncQueueTypes.ts`
  - `storage/sync`
  - tests de `syncQueueService` y `sync-resilience`
- Los puertos de `sync/` deben permanecer agnósticos de React/UI.
- `legacyFirebase*` y `localStorageService.ts` son compatibilidad controlada; no deben
  reingresar al camino caliente del registro diario.

## Operación

- Runbook soporte sync/resiliencia: `docs/RUNBOOK_SYNC_RESILIENCE.md`
- Budgets y thresholds operativos: `docs/RUNBOOK_OPERATIONAL_BUDGETS.md`
- Si IndexedDB cae en modo degradado persistente, el sistema reduce ruido de reintentos y mantiene el fallback activo durante la sesión.
- Los avisos visibles priorizan lenguaje no técnico y reservan acciones avanzadas solo para casos persistentes.
