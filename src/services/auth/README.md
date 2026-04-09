# `src/services/auth`

## Proposito

Resolver autenticacion, bootstrap de sesion, claims, roles y degradacion operativa del acceso.

## Estructura

- `authSession.ts` y `authSessionState.ts`: contrato canonico de sesion.
- `authFlow.ts`, `authGoogleFlow.ts`, `authCredentialFlow.ts`: ejecucion de login.
- `authRoleLookup.ts`, `authAccessResolution.ts`, `authClaimSyncService.ts`: resolucion de rol y sincronizacion de claims.
- `authErrorPolicy.ts`, `authUiCopy.ts`, `authOperationalTelemetry.ts`: copy, errores y observabilidad.
- `authRuntimeSnapshot.ts`: snapshot operativo reutilizable para bootstrap, sesion y reporter.
- `clientOperationalRuntimeSnapshot.ts` compone auth con persistencia local y sync desde observability.
- `useAuthState.ts` expone `remoteSyncStatus` como contrato canonico para consumers que necesitan decidir si el runtime remoto esta `ready`, `bootstrapping` o `local_only`.
  Ese estado debe seguir siendo una derivacion liviana del bootstrap de auth, no una segunda FSM con timers y overrides implícitos.

## Decision Guide

- Runtime y recovery de auth: [docs/ADR_AUTH_RUNTIME_RECOVERY.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/ADR_AUTH_RUNTIME_RECOVERY.md)
- Modelo de acceso del producto: [docs/AUTH_ACCESS_MODEL.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/AUTH_ACCESS_MODEL.md)
- Runbook de incidentes de acceso: [docs/RUNBOOK_AUTH_ACCESS_INCIDENTS.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/RUNBOOK_AUTH_ACCESS_INCIDENTS.md)

## Contratos principales

- La UI debe consumir estado de sesion, no inferir auth por `user/null`.
- La UI y los reporters deben preferir `authRuntimeSnapshot` cuando necesiten razonamiento operativo
  (`budgetProfile`, `pendingAgeMs`, `runtimeState`) en vez de reconstruirlo con flags ad hoc.
- La UI que dependa de sync remoto debe consumir `remoteSyncStatus`; no debe reconstruirlo mezclando `authLoading`, `sessionState` e `isFirebaseConnected`.
- El bootstrap debe intentar resolver primero el resultado de redirect y luego rehidratar la sesion
  actual de Firebase antes de depender del observer continuo de `onAuthStateChanged`.
- Si el bootstrap agota su presupuesto y aun existe hint de sesion persistida, debe intentar una
  revalidacion final de `currentSession` antes de degradar a `unauthenticated`.
- El rol canonico del producto viene de `config/roles`; custom claims complementan recursos que lo requieren.
- Los fallos de claims o redirect no deben romper la carga de la app; deben degradar a estado controlado.

## Permisos e invariantes

- `anonymous_signature` es un estado soportado, no un hack implícito.
- Si un recurso depende de custom claim, la sesion debe intentar refresh/sync antes de asumir fallo definitivo.
- No reintroducir decisiones de auth repartidas entre hooks, context y componentes.
- El login por Google puede devolver errores recuperables de popup durante cambios de sesion
  (`admin -> especialista`, por ejemplo). La UI debe esperar una breve ventana de gracia antes de
  mostrar error si la sesion ya se está resolviendo.
- Si el popup de Google falla por COOP, `window.closed` o errores internos recuperables del SDK,
  el flujo debe degradar automaticamente a redirect antes de exponer error al usuario.
- La sincronizacion de custom claims no debe bloquear la entrega inicial de una sesion autorizada.
- Los warnings benignos de bootstrap o configuracion incompleta deben resolverse mediante
  `operationalNoticePolicy`; auth no debe inventar severidades o copy inline por pantalla.

## Legacy activo

- La compatibilidad cliente `authService.ts` / `index.ts` fue retirada.
- La deuda legacy restante de auth queda gobernada en `scripts/config/compatibility-governance.json`
  y hoy se concentra en functions/rules ligadas al alias legacy del rol viewer.

## Checks recomendados

- `npm run test:risk:auth`
- `npm run typecheck`
- `npm run check:quality`
