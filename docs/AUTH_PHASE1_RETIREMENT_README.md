# Fase 1: Retiro de Compatibility Bridges de Auth

## Objetivo

Retirar progresivamente las superficies de compatibilidad de auth inventariadas en
`scripts/config/compatibility-governance.json`, empezando por las del cliente y dejando
documentada la evidencia pendiente para las compatibilidades operativas del backend.

## Alcance Gobernado

1. `src/services/auth/authService.ts`
2. `src/services/auth/index.ts`
3. `functions/lib/auth/authHelpersFactory.js`
4. `netlify/functions/lib/firebase-auth.ts`
5. `firestore.rules`
6. `storage.rules`

## Subfases

### Subfase 1A: Retiro cliente

- Migrar consumidores de produccion a `authFlow`, `authSession` y `authFallback`.
- Migrar tests y mocks globales que todavia dependan de `authService`.
- Retirar `authService.ts` e `index.ts`.
- Actualizar gobernanza, reportes y README relacionados.

### Subfase 1B: Compatibilidad operativa backend

- Verificar evidencia real de `viewer_census` en claims, `config/roles` y funciones desplegadas.
- Retirar write-back y aliasing legacy en helpers serverless solo cuando la evidencia operacional lo permita.
- Recortar `firestore.rules` y `storage.rules` al rol canonico cuando ya no existan sesiones/config legacy activas.

## Registro Iterativo

### 2026-04-08 - Iteracion 1

#### Contexto verificado

- En produccion solo quedaban dos consumidores del barrel/facade cliente:
  - `src/application/auth/authSessionUseCases.ts`
  - `src/hooks/useAuthState.ts`
- La compatibilidad `viewer_census -> viewer` sigue viva en funciones/rules y esta gobernada por criterios operativos, no solo por refactor mecanico.

#### Decisiones tomadas

- Ejecutar completa la subfase cliente en esta iteracion.
- No retirar todavia las bridges de backend/rules sin evidencia operacional de recanonizacion.
- Dejar la siguiente subfase preparada y explicitamente bloqueada por verificacion de despliegue/datos.

#### Cambios realizados

- Consumidores de auth del cliente migrados a entrypoints canonicos:
  - `authFlow.ts`
  - `authSession.ts`
  - `authFallback.ts`
- Tests y mocks globales alineados al nuevo surface canónico.
- `authService.ts` e `index.ts` retirados del codigo fuente.
- Gobernanza y reportes actualizados para reflejar que la deuda restante de Fase 1 queda en backend/rules.

#### Validacion esperada

- Suite focalizada de auth/useAuthState/integration verde.
- `reports/compatibility-governance.{md,json}` con 4 entradas restantes.
- Sin imports productivos a `@/services/auth` ni a `@/services/auth/authService`.

#### Validacion ejecutada

- `npm exec vitest run src/tests/application/auth/authSessionUseCases.test.ts src/tests/hooks/useAuthState.test.ts src/tests/integration/authSyncDeployLifecycle.test.tsx src/tests/services/authService.test.ts src/tests/integration/flicker-free-login.test.tsx src/tests/security/legacyRoleAliasStatic.test.ts`
  - Resultado: 6 archivos, 36 tests, todo verde.
- `node scripts/check-security-hardening.mjs`
  - Resultado: ok.
- `reports/compatibility-governance.{md,json}`
  - Resultado: 4 bridges restantes.
- Barrido de imports productivos:
  - Resultado: sin imports a `@/services/auth`.

## Estado Actual

- Subfase 1A: completada
- Subfase 1B: pendiente, bloqueada por evidencia operacional

## Siguiente Decision

Cuando termine la validacion de esta iteracion:

1. Si la suite focalizada pasa, cerrar Subfase 1A como completada.
2. Abrir Subfase 1B con inventario de claims/config legacy reales en produccion.
3. No tocar `viewer_census` en rules/functions hasta tener esa evidencia.

### 2026-04-08 - Iteracion 2

#### Objetivo

Reducir la vida operativa real del bridge backend sin retirar todavia rules/functions a ciegas.

#### Cambios realizados

- `useRoleManagement` ahora no solo recanoniza aliases legacy en `config/roles`.
- Cuando detecta entradas migradas, intenta tambien resincronizar el custom claim canónico mediante `forceSyncUser`.
- Si la resincronizacion falla, la UI conserva el listado de roles cargado y muestra una advertencia accionable.
- Se agrego el audit operativo `functions/scripts/auditLegacyViewerAlias.js` para medir readiness real de retiro.
- Se actualizo la documentacion canónica para reflejar este comportamiento operativo.

#### Impacto

- Baja el riesgo de que queden claims legacy activos despues de una normalizacion de `config/roles`.
- Acerca el retiro futuro de `storage.rules` y `firestore.rules` porque reduce la necesidad de compatibilidad prolongada.
- Sigue faltando evidencia de produccion para eliminar por completo `viewer_census` en backend/rules.

#### Siguiente decision

1. Ejecutar `cd functions && npm run audit:legacy-viewer-alias`.
2. Si no quedan aliases ni claims legacy activos, retirar compatibilidad en helpers backend.
3. Luego recortar `firestore.rules` y `storage.rules` al rol canónico.

#### Validacion ejecutada

- `npm exec vitest run src/tests/hooks/useRoleManagement.test.ts src/tests/services/admin/roleService.test.ts`
  - Resultado: verde.
- `npm exec vitest run src/tests/security/legacyRoleAliasStatic.test.ts`
  - Resultado: verde.
- `node --check functions/scripts/auditLegacyViewerAlias.js`
  - Resultado: ok.
- `cd functions && npm run audit:legacy-viewer-alias`
  - Resultado: bloqueado en este entorno por falta de `Project ID`/credenciales Firebase Admin para leer datos reales.
