# Runbook Técnico de Soporte Operacional

## Objetivo

Estandarizar respuesta de soporte ante incidentes de datos, sincronización y permisos.

Este runbook complementa `docs/RUNBOOK_SYNC_RESILIENCE.md` con una pauta más operativa (triage + decisión + cierre).

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

## Controles Nuevos (Auth + Legacy)

- Login redirect protegido:
  - Se usa marca temporal `hhr_auth_bootstrap_pending_v1` para evitar rebote prematuro a Login durante retorno de Google redirect.
  - Timeout extendido de bootstrap auth a 45s cuando la marca está activa.
  - Heartbeat de lock multi-pestaña durante popup (`hhr_google_login_lock_v1`) para evitar colisiones en inicios largos.
  - Política unificada de errores de auth popup/COOP (`authErrorPolicy`) para decidir cuándo mostrar acceso alternativo por redirect.
- Legacy fallback con menor ruido:
  - Bloqueo persistente por sesión cuando hay `permission-denied` en legacy.
  - Cache temporal de fechas no encontradas (evita reintentos repetidos sobre rutas legacy inválidas).
  - Logs de repositorio legacy sólo en modo debug explícito (`VITE_DEBUG_REPOSITORY=true`).
- Backups Storage (contrato de fecha):
  - Servicios de respaldo (`censo`, `CUDYR`, `PDF`) validan fecha de entrada con formato `YYYY-MM-DD` y calendario válido.
  - Entradas inválidas se degradan de forma segura (sin romper UI ni cola).
  - En operaciones de consulta/borrado, una fecha inválida responde `false/null/no-op` (sin excepción operativa).
  - En operaciones de subida, si Storage no está inicializado se emite error explícito de inicialización.
  - Clasificación unificada de errores Storage:
    - `not_found` / `permission_denied` / `unauthenticated` se tratan como no fatales en checks de existencia.
    - `unknown` se mantiene visible en logs para investigación.

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
6. Si el error es en fuentes legacy:
   - Confirmar que el bloqueo de lectura legacy quedó activo para la sesión (sin spam de consola).
   - No forzar reintentos manuales sobre rutas legacy si ya hay bloqueo.

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

## Variables de Diagnóstico (solo soporte técnico)

- `VITE_DEBUG_REPOSITORY=true`:
  - Habilita logs de trazas de repositorio (Firestore + fallback legacy).
  - Mantener desactivado en operación normal para evitar ruido.
- `VITE_DEBUG_LEGACY_FIREBASE=true`:
  - Habilita logs detallados de rutas legacy.
  - Usar sólo para diagnóstico acotado y luego desactivar.
- Trazas `[StoragePerf]`:
  - Se emiten automáticamente como advertencia cuando una operación Storage supera el umbral de latencia.
  - No requieren activar flags adicionales en operación normal.
- `E2E_BUDGET_LOGIN_VISIBLE_MS`, `E2E_BUDGET_AUTH_FEEDBACK_MS`, `E2E_BUDGET_CENSO_VISIBLE_MS`:
  - Umbrales del test de performance de arranque en CI.
  - Ajustar sólo con evidencia de hardware/red del entorno objetivo.

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
npm run test:risk:admin-health
npm run test:risk:auth
npm run test:risk:platform
npm run test:sync-load
npm run test:rules:ci
npm run test:emulator:sync:ci
npm run test:e2e:critical:ci
npm run test:e2e -- e2e/auth-multi-tab-lock.spec.ts
npm run test -- src/tests/security/netlifyHeadersStatic.test.ts
```

Parámetros opcionales para carga de cola:

```bash
SYNC_QUEUE_LOAD_VOLUME=120 SYNC_QUEUE_RETRY_VOLUME=40 SYNC_QUEUE_LOAD_MAX_MS=8000 npm run test:sync-load
```

## SLA Operacional Recomendado

- `SEV-1`: respuesta < 15 min, mitigación inicial < 60 min.
- `SEV-2`: respuesta < 60 min, mitigación < 4 h.
- `SEV-3`: respuesta mismo día hábil.
