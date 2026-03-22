# Quality Guardrails

## Objetivo

Evitar que la deuda estructural vuelva a crecer después de las fases de estabilización de `clinical-documents`, `census` y `transfers`.

## Capas estándar

| Capa           | Responsabilidad                                  |
| -------------- | ------------------------------------------------ |
| `components/`  | Render y composición visual                      |
| `hooks/`       | Coordinación React y wiring de dependencias      |
| `controllers/` | Lógica pura, mapeos, policies y validaciones     |
| `application/` | Casos de uso y orquestación tipada               |
| `domain/`      | Invariantes de negocio y contratos del módulo    |
| `services/`    | IO, persistencia, infraestructura, integraciones |

## Reglas de crecimiento

1. Un archivo que supere el límite global de tamaño debe entrar documentado en `scripts/module-size-allowlist.json`.
2. Todo hotspot permitido debe incluir motivo, owner y estado en el backlog versionado.
3. Un hotspot permitido no puede crecer por sobre su límite sin actualizar explícitamente la allowlist.
4. Los hooks grandes usan `scripts/hook-hotspots-limits.json` con la misma disciplina de backlog.
5. La regla por defecto es extraer controllers/helpers puros antes de mover JSX o cambiar contratos públicos.
6. `npm run lint` es tolerancia cero; no se aceptan warnings nuevos en `src/`.
7. Los providers de infraestructura obligatorios deben fallar rápido si falta wiring.

## Cómo agregar un guardrail nuevo

1. Preferir `scripts/check-*.mjs` o `scripts/report-*.mjs` antes de introducir tooling externo.
2. Si el guardrail es informativo, agregarlo primero como report-only.
3. Si luego se vuelve blocking, dejar baseline/allowlist documentada.
4. Enlazar el guardrail nuevo desde `package.json`, CI y esta guía.

## Entry points de calidad

- `npm run ci:inner-loop`
- `npm run ci:merge-gate`
- `npm run ci:release-gate`
- `npm run ci:quality-core`
- `npm run check:quality`
- `npm run check:test-failure-catalog`
- `npm run check:hotspot-growth`
- `npm run report:quality-metrics`
- `npm run report:operational-health`
- `npm run report:system-confidence`
- `npm run report:runtime-contracts`
- `npm run report:critical-coverage`
- `npm run check:flow-performance-budget`
- `npm run report:flow-performance-budget`

## Operación diaria

- El mapa corto de ejecución y fallback vive en [docs/CI_GATES_AND_FAILURE_RUNBOOKS.md](./CI_GATES_AND_FAILURE_RUNBOOKS.md).
- `ci:inner-loop` es la ruta local rápida.
- `ci:merge-gate` es la ruta blocking previa a merge.
- `ci:release-gate` agrega emuladores, reglas y E2E críticos.
- Los budgets por flujo se leen desde `reports/e2e/flow-performance-budget.json` y su resumen en `reports/e2e/flow-performance-budget-summary.json` / `.md`.
- El estado operativo por flujo distingue `ok`, `near-limit`, `target-miss` y `blocking`.
- La definición de terminado vive en [docs/ENGINEERING_DEFINITION_OF_DONE.md](./ENGINEERING_DEFINITION_OF_DONE.md).
- La deuda priorizada vive en [docs/TECHNICAL_DEBT_REGISTER.md](./TECHNICAL_DEBT_REGISTER.md).
- Los fallos conocidos no resueltos deben vivir en `scripts/config/test-failure-catalog.json` con owner, clasificación y SLA.
- Los riesgos flaky aceptados temporalmente deben vivir en `scripts/config/flaky-quarantine.json` y reflejarse también en el catálogo de fallos.

## Cuándo abrir una excepción

Solo cuando se cumplan las dos condiciones:

1. partir el archivo en esa iteración rompe contratos o consume demasiado riesgo clínico/operativo;
2. la excepción queda anotada en backlog con límite, motivo y owner claros.

Si no se cumplen ambas, el archivo debe reducirse en la misma change.
