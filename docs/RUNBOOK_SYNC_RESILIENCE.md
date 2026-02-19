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

Acciones:

1. Confirmar conectividad (`ONLINE` en dashboard).
2. Esperar 1 ciclo de reintento (backoff).
3. Si no baja, recargar sesión del usuario.
4. Si sigue crítico, solicitar captura de consola y revisar tipo de error:
   - `permission-denied` -> ir a Procedimiento 3.
   - `ConcurrencyError` -> ir a Procedimiento 4.

Verificación:

- `pendingSyncTasks` desciende.
- `retryingSyncTasks` retorna a 0.

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

## Diagnóstico local (desarrollo/soporte técnico)

Comandos:

```bash
npm run typecheck
npm run check:quality
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
