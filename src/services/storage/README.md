# `src/services/storage`

## Propósito

Capa de persistencia concreta: IndexedDB, localStorage, Firestore bridge y sincronización.

## Mapa

| Path/Archivo                                  | Propósito                                             |
| --------------------------------------------- | ----------------------------------------------------- |
| `indexedDBService.ts`                         | API de alto nivel para IndexedDB                      |
| `localStorageService.ts`                      | Gateway legacy mínimo para records/nurses/maintenance |
| `unifiedLocalService.ts`                      | Facade de compatibilidad local no-demo                |
| `firestoreService.ts`                         | Operaciones Firestore de registro diario              |
| `syncQueueService.ts`                         | Cola de sincronización offline/online                 |
| `syncQueueTypes.ts`                           | Tipos de cola de sincronización                       |
| `tableConfigService.ts`                       | Persistencia de configuración de tablas               |
| `uiSettingsService.ts`                        | Persistencia de preferencias UI                       |
| `localpersistence/localPersistenceService.ts` | Fallback local unificado (records/settings)           |
| `index.ts`                                    | Exports de storage                                    |
| `indexeddb/` / `localstorage/` / `firestore/` | Implementaciones más finas por backend                |

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
- `legacyFirebaseService.ts` concentra la compatibilidad histórica de lectura desde rutas Firestore antiguas.
- `legacyFirebaseRecordService.ts` se mantiene como fachada pública interna para record reads, rangos, suscripciones y discovery, con módulos especializados por responsabilidad.
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

## Operación

- Runbook soporte sync/resiliencia: `docs/RUNBOOK_SYNC_RESILIENCE.md`
- Si IndexedDB cae en modo degradado persistente, el sistema reduce ruido de reintentos y mantiene el fallback activo durante la sesión.
