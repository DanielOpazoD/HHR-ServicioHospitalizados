# Guía de Testing - Hospital Hanga Roa

Este documento resume cómo se valida el repo hoy, con gates por capas y cobertura crítica instrumentada.

## 1. Capas de prueba

### Unitarias y de integración (`src/tests/`)

Cobren hooks, controllers, casos de uso, repositorios, contratos runtime y flujos integrados de negocio.

### Reglas y emulador

Validan seguridad Firestore, sincronización y comportamiento de adapters con emulador local.

### E2E (`e2e/`)

Playwright cubre auth, startup, módulos críticos y regresiones de UX prioritaria.

## 2. Comandos vigentes

| Comando                                   | Descripción                                                                                                               |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `npm run test:ci:unit`                    | Suite unitaria/integración de CI sin reglas ni emulador                                                                   |
| `npm run test:coverage:critical`          | Cobertura crítica instrumentada por zona                                                                                  |
| `npm run test:smoke:critical-runtime`     | Smoke pack curado para `cold boot`, `login`, `offline -> online`, `sync conflict`, `export` y `clinical-documents`        |
| `npm run test:release-confidence`         | Pack compacto blocking de release confidence: smoke runtime, rules, emulador, coverage, performance y E2E críticos        |
| `npm run test:release-confidence:full`    | Pack extendido de release confidence: agrega `unit_critical` para corridas de validación más profundas                    |
| `npm run test:e2e:critical`               | E2E críticos sobre emulador                                                                                               |
| `npm run test:e2e:flow-performance`       | Budgets de performance por flujo (`login`, `auth`, `censo visible`, `censo record-ready`, `clinical-documents`, `backup`) |
| `npm run test:rules`                      | Reglas Firestore                                                                                                          |
| `npm run test:emulator:sync`              | Suite de emulador sync                                                                                                    |
| `npm run test:emulator:ui`                | Suite de emulador UI                                                                                                      |
| `npm run check:critical-smoke-pack`       | Verifica que el smoke pack crítico siga cubriendo todos los escenarios obligatorios                                       |
| `npm run check:release-confidence-pack`   | Verifica perfiles, tiers, solapes permitidos y scripts válidos del release confidence pack                                |
| `npm run check:release-confidence-matrix` | Verifica que cada área crítica tenga trazabilidad explícita hacia coverage, smoke, budgets y pasos blocking de release    |
| `npm run ci:inner-loop`                   | Ruta rápida para desarrollo diario                                                                                        |
| `npm run ci:merge-gate`                   | Ruta blocking previa a merge                                                                                              |
| `npm run ci:release-gate`                 | Ruta completa con Firestore + E2E                                                                                         |

## 3. Cobertura crítica

La cobertura crítica ya no se gobierna por conteo de tests o ratios test/source.

Ahora se valida por zonas instrumentadas:

- `census/controllers`
- `clinical-documents`
- `services/transfers`
- `services/storage/firestore`
- `services/auth/bootstrap`
- `features/reminders/admin`
- `services/storage/sync-critical`
- `services/storage/indexeddb-recovery`

Artefactos:

- `reports/critical-coverage.md`
- `reports/critical-coverage.json`

## 4. Performance por flujo

Artefacto actual:

- `reports/e2e/flow-performance-budget.json`
- `reports/e2e/flow-performance-budget-summary.json`
- `reports/e2e/flow-performance-budget.md`

Comandos:

- `npm run test:e2e:flow-performance`
- `npm run check:flow-performance-budget`

El budget diferencia entre:

- `enforcedMaxMs`: límite blocking actual
- `targetMs`: objetivo deseado, útil para exponer gaps sin romper CI de inmediato
- `status` por flujo en el reporte generado: `ok`, `near-limit`, `target-miss`, `blocking`

## 5. Criterio práctico

1. Si la change es local o todavía exploratoria, correr `npm run ci:inner-loop`.
2. Si toca código clínico, runtime, bundle o cobertura, correr `npm run ci:merge-gate`.
3. Si toca Firestore, reglas, emulador o UX crítica, cerrar con `npm run ci:release-gate`.

## 5.1 Smoke Pack Crítico

El smoke pack curado vive en `scripts/config/critical-smoke-pack.json`.

Escenarios obligatorios:

- `cold_boot`
- `login`
- `offline_to_online`
- `sync_conflict`
- `export`
- `clinical_documents`

Objetivo: asegurar una ruta rápida y estable de validación operativa sin depender de toda la suite.

## 5.2 Perfil especialista

El perfil `doctor_specialist` ya no tiene un flujo de login o shell paralelo.

El modelo canónico de acceso general vive en [docs/AUTH_ACCESS_MODEL.md](../AUTH_ACCESS_MODEL.md).

Regresiones mínimas esperadas cuando una change toca auth, censo, documentos clínicos o handoff:

- login normal con Gmail
- acceso permitido solo si el correo existe en `config/roles` o bootstrap técnico
- usuario sin rol no monta shell ni navbar
- acceso visible solo a `CENSUS` y `MEDICAL_HANDOFF`
- censo abreviado sin edición de datos censales
- documentos clínicos con edición de `draft`
- entrega médica editable solo en día actual

## 5.3 Release Confidence Pack

El pack versionado vive en `scripts/config/release-confidence-pack.json`.

Perfil blocking por defecto (`npm run test:release-confidence`):

- `runtime_smoke`
- `rules_ci`
- `emulator_sync_ci`
- `critical_coverage`
- `flow_performance`
- `e2e_critical_ci`

Perfil full (`npm run test:release-confidence:full`):

- `unit_critical`
- todo el perfil blocking

Regla de diseño:

- `unit_critical` queda fuera del perfil blocking porque hoy se solapa con `runtime_smoke` y `e2e_critical_ci`
- el perfil blocking debe contener solo pasos `blocking-tier`
- el perfil full existe para auditorías más profundas o corridas de diagnóstico

Objetivo: dejar una ruta blocking más compacta para release, sin perder una variante extendida cuando se necesite profundidad adicional.

## 5.4 Release Confidence Matrix

La matriz versionada vive en `scripts/config/release-confidence-matrix.json`.

Gobierna la trazabilidad entre:

- zonas de `critical coverage`
- escenarios del `critical smoke pack`
- `flow budgets`
- pasos blocking de `test:release-confidence`

Artefactos:

- `reports/release-confidence-matrix.md`
- `reports/release-confidence-matrix.json`

Objetivo: que el pack blocking siga siendo chico, pero con cobertura explícita por área crítica y sin huecos no intencionales entre runtime, coverage y release gates.

## 6. Buenas prácticas

1. Usar mocks compartidos de `src/tests/setup.ts` cuando exista una variante oficial.
2. Evitar `any` en tests; preferir fixtures tipadas y `ApplicationOutcome` explícito.
3. Si aparece una falla E2E, migrar el spec a contratos estables (`data-testid`, ready states, errores visibles) antes de relajar assertions.
4. Si cambia el estándar operativo, actualizar [docs/CI_GATES_AND_FAILURE_RUNBOOKS.md](../CI_GATES_AND_FAILURE_RUNBOOKS.md).
