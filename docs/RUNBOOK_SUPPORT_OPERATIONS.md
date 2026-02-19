# Runbook Técnico de Soporte Operacional

## Objetivo

Estandarizar respuesta de soporte ante incidentes de datos, sincronización y permisos.

Este runbook complementa `/Users/danielopazodamiani/Desktop/FEB 10 2144/docs/RUNBOOK_SYNC_RESILIENCE.md` con una pauta más operativa (triage + decisión + cierre).

## Alcance

- Sincronización Firestore/IndexedDB.
- Cola de sincronización (outbox).
- Conflictos de concurrencia.
- Permisos Firestore/Storage.
- Incidentes de degradación local (IndexedDB fallback).

## Checklist Diario (Soporte)

1. Revisar en `Admin > System Health` usuarios con:
   - `failedSyncTasks > 0`
   - `conflictSyncTasks > 0`
   - `oldestPendingAgeMs > 300000`
2. Validar que no existan usuarios con estado crítico por más de 15 minutos.
3. Confirmar que no hay alertas repetidas de `permission-denied` en consola.
4. Registrar incidentes abiertos/cerrados del día.

## Matriz de Severidad

- `SEV-1`:
  - > 3 usuarios críticos por >30 minutos.
  - Pérdida/corrupción de datos clínicos.
- `SEV-2`:
  - 1-3 usuarios con cola atascada >15 minutos.
  - Conflictos persistentes sin resolución automática.
- `SEV-3`:
  - Incidente individual recuperable (retry/reload).

## Árbol de Decisión Rápido

1. ¿Hay `permission-denied`?
   - Sí: ir a "Caso A".
   - No: continuar.
2. ¿Hay `ConcurrencyError` o `conflictSyncTasks > 0`?
   - Sí: ir a "Caso B".
   - No: continuar.
3. ¿Hay banner de resiliencia / fallback IndexedDB?
   - Sí: ir a "Caso C".
   - No: continuar.
4. ¿`oldestPendingAgeMs` sigue creciendo?
   - Sí: ir a "Caso D".
   - No: monitoreo normal.

## Caso A: Permisos (`permission-denied`)

1. Confirmar email y rol del usuario.
2. Identificar recurso afectado:
   - Firestore (ruta exacta).
   - Storage (ruta exacta).
3. Verificar reglas desplegadas (`firestore.rules`, `storage.rules`).
4. Corregir claim/rol o regla y redeploy.
5. Solicitar al usuario repetir acción.

Criterio de cierre:

- Nuevo intento exitoso.
- Sin `FAILED` nuevos en outbox.

## Caso B: Conflicto de concurrencia

1. Confirmar que el sistema ejecutó merge automático.
2. Validar registro final:
   - Campos clínicos locales preservados.
   - Campos administrativos remotos preservados.
3. Confirmar log de auditoría de auto-merge.
4. Confirmar que cola vuelve a `pending=0`.

Criterio de cierre:

- `conflictSyncTasks=0`.
- Registro consistente en UI y backend.

## Caso C: IndexedDB bloqueado / fallback

1. Pedir cerrar pestañas duplicadas de la app.
2. Usar `Reintentar`.
3. Si persiste, ejecutar `Limpieza Dura`.
4. Recargar y validar fin de banner.

Criterio de cierre:

- Sin banner de resiliencia.
- Persistencia local y sync funcionando.

## Caso D: Cola atascada (`pending` crece)

1. Confirmar conectividad real (`ONLINE` + red estable).
2. Esperar un ciclo de backoff.
3. Forzar recarga de sesión.
4. Si persiste:
   - exportar evidencia de consola.
   - revisar tipo de error dominante.

Criterio de cierre:

- `oldestPendingAgeMs` decrece sostenidamente.
- `retryingSyncTasks` retorna a 0.

## Evidencia Mínima para Escalar a Ingeniería

- Email usuario, hospital, fecha/hora.
- Captura `System Health` (métricas clave).
- Error completo de consola (stack + code).
- Acción exacta que gatilla el problema.
- Estado final tras pasos del runbook.

## Comandos de Diagnóstico Técnico

```bash
npm run typecheck
npm run check:quality
npm run test:resilience
npm run test:sync-load
npm run test:rules:ci
npm run test:emulator:sync:ci
```

Parámetros opcionales para carga de cola:

```bash
SYNC_QUEUE_LOAD_VOLUME=120 SYNC_QUEUE_RETRY_VOLUME=40 SYNC_QUEUE_LOAD_MAX_MS=8000 npm run test:sync-load
```

## SLA Operacional Recomendado

- `SEV-1`: respuesta < 15 min, mitigación inicial < 60 min.
- `SEV-2`: respuesta < 60 min, mitigación < 4 h.
- `SEV-3`: respuesta mismo día hábil.
