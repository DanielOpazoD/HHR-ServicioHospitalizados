# `src/services/auth`

## Proposito

Resolver autenticacion, bootstrap de sesion, claims, roles y degradacion operativa del acceso.

## Estructura

- `authSession.ts` y `authSessionState.ts`: contrato canonico de sesion.
- `authFlow.ts`, `authGoogleFlow.ts`, `authCredentialFlow.ts`: ejecucion de login.
- `authRoleLookup.ts`, `authAccessResolution.ts`, `authClaimSyncService.ts`: resolucion de rol y sincronizacion de claims.
- `authErrorPolicy.ts`, `authUiCopy.ts`, `authOperationalTelemetry.ts`: copy, errores y observabilidad.
- `authService.ts` e `index.ts`: superficies legacy/compatibilidad controladas.

## Contratos principales

- La UI debe consumir estado de sesion, no inferir auth por `user/null`.
- El rol canonico del producto viene de `config/roles`; custom claims complementan recursos que lo requieren.
- Los fallos de claims o redirect no deben romper la carga de la app; deben degradar a estado controlado.

## Permisos e invariantes

- `anonymous_signature` y `shared_census` son estados soportados, no hacks implícitos.
- Si un recurso depende de custom claim, la sesion debe intentar refresh/sync antes de asumir fallo definitivo.
- No reintroducir decisiones de auth repartidas entre hooks, context y componentes.

## Legacy activo

- `authService.ts`
- `index.ts`

## Checks recomendados

- `npm run test:risk:auth`
- `npm run typecheck`
- `npm run check:quality`
