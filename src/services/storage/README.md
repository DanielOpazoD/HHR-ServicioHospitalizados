# `src/services/storage`

## Propósito

Capa de persistencia concreta: IndexedDB, localStorage, Firestore bridge y sincronización.

## Mapa

| Path/Archivo                                  | Propósito                                                   |
| --------------------------------------------- | ----------------------------------------------------------- |
| `indexedDBService.ts`                         | API de alto nivel para IndexedDB                            |
| `localStorageService.ts`                      | Facade localStorage (legacy/deprecado)                      |
| `unifiedLocalService.ts`                      | Facade de compatibilidad sobre persistencia local unificada |
| `firestoreService.ts`                         | Operaciones Firestore de registro diario                    |
| `syncQueueService.ts`                         | Cola de sincronización offline/online                       |
| `syncQueueTypes.ts`                           | Tipos de cola de sincronización                             |
| `tableConfigService.ts`                       | Persistencia de configuración de tablas                     |
| `uiSettingsService.ts`                        | Persistencia de preferencias UI                             |
| `localpersistence/localPersistenceService.ts` | Fallback local unificado (records/settings/demo)            |
| `index.ts`                                    | Exports de storage                                          |
| `indexeddb/` / `localstorage/` / `firestore/` | Implementaciones más finas por backend                      |

## Estrategia

- Offline-first con IndexedDB.
- Fallback controlado en caso de fallo de DB local.
- Sincronización diferida con Firestore.

## Recomendación

Cambios en esta capa requieren:

1. tests de servicios,
2. verificación de degradación/fallback,
3. revisión de impacto en `DailyRecordRepository`.

## Operación

- Runbook soporte sync/resiliencia: `docs/RUNBOOK_SYNC_RESILIENCE.md`
