# `src/services/repositories`

## Propósito

Implementar Repository Pattern para ocultar detalles de almacenamiento/sincronización.

## Mapa

| Archivo                                          | Rol                                      |
| ------------------------------------------------ | ---------------------------------------- |
| `DailyRecordRepository.ts`                       | API unificada del registro diario        |
| `dailyRecordRepositoryReadService.ts`            | Lecturas                                 |
| `dailyRecordRepositoryWriteService.ts`           | Escrituras                               |
| `dailyRecordRepositorySyncService.ts`            | Suscripción/sync con Firestore           |
| `dailyRecordRepositoryInitializationService.ts`  | Inicialización de días/copia de paciente |
| `repositoryConfig.ts`                            | Flags de repo (`firestoreEnabled`)       |
| `CatalogRepository.ts`                           | Catálogos                                |
| `PatientMasterRepository.ts`                     | Base maestra de pacientes                |
| `PrintTemplateRepository.ts`                     | Plantillas de impresión                  |
| `dataMigration.ts` / `patientMasterMigration.ts` | Migraciones                              |
| `monthIntegrity.ts`                              | Integridad mensual                       |
| `contracts/*.ts`                                 | Contratos estrictos de entrada/salida    |
| `index.ts`                                       | Barrel export                            |

## Patrón de uso

```ts
const record = await DailyRecordRepository.getForDate(date);
await DailyRecordRepository.updatePartial(date, patch);
const unsubscribe = DailyRecordRepository.subscribe(date, callback);
```

## Regla

Todo acceso a `DailyRecord` debe pasar por este paquete (evitar acceso directo desde UI a storage).

Los métodos públicos de `DailyRecordRepository` y `PatientMasterRepository` validan/sanean contratos
de entrada (fecha, límites, RUT, IDs) antes de delegar en storage.

## Compatibilidad Histórica de Sync

- `dailyRecordRepositoryInitializationService.ts` conserva bootstrap compatible con:
  - registros ya presentes en IndexedDB
  - lectura remota actual desde Firestore
  - fallback de lectura legacy vía `legacyFirebaseService.ts`
- `dailyRecordRemoteLoader.ts` centraliza la resolución `Firestore -> legacy -> cache local`
  para evitar que la compatibilidad histórica quede duplicada entre lectura y sync.
- `dataMigration.ts` sigue siendo el punto único para adaptar shapes legacy al schema vigente.
- Si se cambia cualquier regla de compatibilidad, deben actualizarse:
  - tests de `dataMigration`
  - tests de `DailyRecordRepository`
  - al menos una prueba de integración de sync
