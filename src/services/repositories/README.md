# `src/services/repositories`

## Propósito

Implementar Repository Pattern para ocultar detalles de almacenamiento/sincronización.

## Mapa

| Archivo                                            | Rol                                      |
| -------------------------------------------------- | ---------------------------------------- |
| `DailyRecordRepository.ts`                         | API unificada del registro diario        |
| `dailyRecordRepositoryReadService.ts`              | Lecturas                                 |
| `dailyRecordRepositoryWriteService.ts`             | Escrituras                               |
| `dailyRecordRepositorySyncService.ts`              | Suscripción/sync con Firestore           |
| `dailyRecordRepositoryInitializationService.ts`    | Inicialización de días/copia de paciente |
| `repositoryConfig.ts`                              | Flags de repo (`firestoreEnabled`)       |
| `CatalogRepository.ts`                             | Catálogos                                |
| `PatientMasterRepository.ts`                       | Base maestra de pacientes                |
| `PrintTemplateRepository.ts`                       | Plantillas de impresión                  |
| `dataMigration.ts` / `patientMasterMigration.ts`   | Migraciones                              |
| `schemaGovernance.ts` / `schemaEvolutionPolicy.ts` | Política de versionado y compatibilidad  |
| `legacyRecordBridgeService.ts`                     | Importación explícita desde rutas legacy |
| `monthIntegrity.ts`                                | Integridad mensual                       |
| `contracts/*.ts`                                   | Contratos estrictos de entrada/salida    |
| `index.ts`                                         | Barrel export                            |

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
  - creación en blanco o desde copia local cuando no existe remoto actual
- `dailyRecordRemoteLoader.ts` quedó restringido al remoto vigente (`Firestore -> cache local`).
  La compatibilidad histórica dejó de formar parte del camino caliente.
- `legacyRecordBridgeService.ts` es la única vía soportada para importar datos legacy; la
  app puede invocarlo explícitamente sin reintroducir fallback histórico en lectura o sync normal.
- `repositoryPerformance.ts` concentra la telemetría ligera de operaciones críticas (`getForDate`,
  `initializeDay`, `syncWithFirestore`, `ensureMonthIntegrity`) para evitar mediciones dispersas.
- `dailyRecordRepositoryInitializationService.ts` resuelve una semilla de arranque explícita
  (`remote_firestore`, `copy_source`, `fresh`) antes de construir o reutilizar
  el día, evitando mezclar en un mismo bloque la carga remota, la herencia local y la creación
  del registro nuevo.
- `dailyRecordRepositoryWriteService.ts` aplica una policy compartida de recuperación de escritura:
  - validación de compatibilidad antes de guardar completo
  - control de concurrencia también en `updatePartial`
  - auto-merge auditado solo cuando existe un remoto recuperable
  - rechazo explícito si el conflicto no puede resolverse sin arriesgar pérdida de datos
- `dataMigration.ts` sigue siendo el punto único para adaptar shapes legacy al schema vigente, y
  expone un reporte de reglas aplicadas y una intensidad de compatibilidad para distinguir entre
  normalización liviana, promoción de staff legacy y puentes de schema histórico.
- `schemaEvolutionPolicy.ts` y `migrationLedger.ts` definen la estrategia de evolución:
  - versión actual soportada por runtime
  - compatibilidad hacia adelante
  - qué cambios requieren bridge legacy o migración normal
- `dailyRecordAggregate.ts` expone facetas del dominio (`clinical`, `staffing`, `movements`,
  `handoff`, `metadata`) para bajar acoplamiento sobre el contrato monolítico de `DailyRecord`.
- Si se cambia cualquier regla de compatibilidad, deben actualizarse:
  - tests de `dataMigration`
  - tests de `dailyRecordRemoteLoader`
  - tests de `DailyRecordRepository`
  - al menos una prueba de integración de sync
