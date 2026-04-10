# Runbook Operativo: Sync y Resiliencia

## Objetivo

Guía rápida para soporte ante incidentes de datos/sincronización:

- IndexedDB bloqueado (modo degradado).
- Cola de sincronización atascada (outbox).
- Errores de permisos (`permission-denied`).
- Conflictos de concurrencia (`ConcurrencyError`).

## Señales clave en dashboard

Revisar `Admin > System Health` por usuario:

- `pendingMutations`
- `pendingSyncTasks`
- `failedSyncTasks`
- `conflictSyncTasks`
- `retryingSyncTasks`
- `oldestPendingAgeMs`
- Diagnóstico (causas) y `Siguiente acción` sugerida por tarjeta

Umbrales operativos:

- `warning`: `oldestPendingAgeMs >= 5 min` o `retryingSyncTasks >= 1`
- `critical`: `oldestPendingAgeMs >= 15 min` o `retryingSyncTasks >= 3` o `failed/conflict > 0`
- Snapshot técnico base: `reports/operational-health.md`
- Budgets completos: `docs/RUNBOOK_OPERATIONAL_BUDGETS.md`

## Diagnostico rapido del arranque

Cuando el incidente ocurre "solo al abrir" o "tras F5", revisar este orden antes de asumir
pérdida real de datos:

1. `remoteSyncStatus`
   - `bootstrapping`: auth/Firebase aun no terminan de resolver.
   - `ready`: el runtime remoto ya puede leer/suscribirse.
   - `local_only`: la app quedó degradada a modo local.
2. `remoteSyncState.reason`
   - `auth_loading`: bootstrap auth todavía pendiente.
   - `auth_connecting`: hay sesión válida pero el runtime remoto aún no materializa conexión usable.
   - `offline`: degradación por red.
   - `runtime_unavailable`: auth resolvió, pero el runtime remoto/config sigue no usable.
   - `auth_unavailable`: no hay sesión reutilizable.
   - `ready`: remoto operativo.
3. `isFirebaseConnected`
   - si está en `false`, el shell no debe habilitar realtime.
4. `recordRuntime.availabilityState`
   - `resolved` o `recoverable_local`: hay registro usable.
   - `temporarily_unavailable`: falló la lectura remota; no tratarlo como "no existe".
   - `confirmed_missing`: el repositorio sí confirmó ausencia real.
5. `bootstrapPhase`
   - `remote_runtime_bootstrapping`: auth/runtime remoto aun se está rehidratando.
   - `remote_record_bootstrapping`: el runtime está listo, pero la primera lectura del día sigue pendiente.
   - `remote_record_timeout`: la primera lectura remota no resolvió dentro de la ventana esperada.
   - `confirmed_empty`: ausencia real confirmada.
   - `local_only`: degradación a IndexedDB/local.
   - `record_ready`: el registro quedó resuelto para la UI.

Referencia técnica:

- [dailyRecordBootstrapController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/hooks/controllers/dailyRecordBootstrapController.ts)
- [useDailyRecordSyncQuery.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/hooks/useDailyRecordSyncQuery.ts)
- [useDailyRecordQuery.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/hooks/useDailyRecordQuery.ts)

## Procedimiento 1: IndexedDB bloqueado

Síntomas:

- Banner: "Resiliencia de Almacenamiento".
- Logs `IndexedDB` con fallback/mode degraded.

Acciones:

1. Pedir al usuario cerrar pestañas duplicadas de la app.
2. En la alerta usar `Reintentar`.
3. Si persiste, usar `Limpieza Dura` (pierde cache local no sincronizada).
4. Forzar recarga y validar que desaparezca el banner.

Verificación:

- `oldestPendingAgeMs` baja progresivamente.
- Nuevos cambios se guardan sin warning de fallback.

## Procedimiento 2: Cola atascada

Síntomas:

- `pendingSyncTasks` crece.
- `oldestPendingAgeMs` supera 15 min.
- `orphanedTasks` > 0 en telemetría de sync.

Acciones:

1. Confirmar conectividad (`ONLINE` en dashboard).
2. Revisar si el usuario actual heredó ownership local extraño:
   - `ownerKey` de telemetría debe corresponder al usuario autenticado.
   - `orphanedTasks > 0` indica tareas de otra sesión local no drenadas.
3. Esperar 1 ciclo de reintento (backoff).
4. Si no baja, recargar sesión del usuario.
5. Si sigue crítico, solicitar captura de consola y revisar tipo de error:
   - `permission-denied` -> ir a Procedimiento 3.
   - `ConcurrencyError` -> ir a Procedimiento 4.

Verificación:

- `pendingSyncTasks` desciende.
- `retryingSyncTasks` retorna a 0.
- `orphanedTasks` queda en 0 tras cambio de usuario/logout manual.

## Procedimiento 2.1: contaminación entre sesiones locales

Síntomas:

- un usuario nuevo ve tareas pendientes que no generó;
- `ownerKey` no coincide con la sesión autenticada;
- `orphanedTasks` permanece > 0.

Acciones:

1. Forzar logout manual del usuario actual.
2. Confirmar que el cliente limpie estado sensible local de sesión.
3. Reingresar con el usuario correcto.
4. Si el problema persiste, ejecutar limpieza dura y escalar como incidente de aislamiento de sesión.

Verificación:

- el outbox vuelve a ownership del usuario actual;
- no reaparecen tareas del usuario anterior;
- `pendingSyncTasks` refleja solo actividad actual.

## Procedimiento 3: `permission-denied`

Síntomas:

- Consola: `Missing or insufficient permissions`.
- Outbox en estado `FAILED` sin recuperación automática.

Acciones:

1. Confirmar email y rol del usuario.
2. Validar colección/ruta afectada:
   - Firestore (`hospitals/{id}/...`, `stats/system_health/...`, etc.)
   - Storage (`censo-diario/...`, `entregas-enfermeria/...`)
3. Revisar reglas actuales:
   - `firestore.rules`
   - `storage.rules`
4. Corregir rol/permisos y redeploy de reglas.

Verificación:

- Nuevo intento ya no cae en `FAILED`.
- En dashboard desaparecen fallos de sync para ese usuario.

## Procedimiento 4: Conflicto de concurrencia

Síntomas:

- Error `ConcurrencyError`.
- `conflictSyncTasks > 0`.

Acciones:

1. Confirmar que la app aplicó merge automático.
2. Verificar que campos clínicos locales se preservaron.
3. Validar que cambios administrativos remotos no se perdieron.
4. Confirmar que se encoló actualización consolidada.

Verificación:

- Registro final consistente en UI.
- `conflictSyncTasks` vuelve a 0 tras flush.

## Conflictos por contexto

Si el conflicto fue clasificado por contexto, priorizar esta revisión:

- `clinical`: validar que camas, pacientes y crib clínico preserven la última edición segura.
- `staffing`: confirmar tens/enfermeras y camas extra activas del turno.
- `movements`: revisar altas, traslados y CMA antes de reintentar.
- `handoff`: confirmar notas/responsables de entrega antes de cerrar.
- `metadata`: revisar `lastUpdated`, `schemaVersion`, `dateTimestamp` y reapertura.
- `unknown`: escalar a ingeniería con paths afectados y evidencia.

Referencia: `reports/operational-health.md` y `conflictos por contexto` allí listados.

## Legacy bridge controlado

Si el incidente involucra carga histórica o migración:

1. revisar `reports/legacy-bridge-governance.md`
2. confirmar que el `legacy bridge` no se reinsertó en el hot path
3. usar solo entrypoints explícitas de bridge, nunca lecturas directas legacy

## Diagnóstico local (desarrollo/soporte técnico)

Comandos:

```bash
npm run typecheck
npm run check:quality
npm run check:operational-runbooks
npm run report:operational-health
npm run test:rules:ci
npm run test -- src/tests/integration/sync-resilience.test.ts
npm run test -- src/tests/integration/sync-ui-resilience.test.tsx
```

## Escalamiento

Escalar a ingeniería si ocurre cualquiera:

- Más de 3 usuarios críticos simultáneos por > 30 min.
- `permission-denied` en rutas previamente operativas.
- Corrupción de datos observada (campos vacíos inesperados tras sync).

Adjuntar en el ticket:

- Usuario/email, fecha/hora, hospital.
- Captura dashboard (métricas de sync).
- Error de consola completo.
