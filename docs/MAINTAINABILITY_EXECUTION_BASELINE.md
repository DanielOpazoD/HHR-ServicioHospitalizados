# Maintainability Execution Baseline

Baseline operativo para ejecutar el plan de mejora técnica por bloques iterativos.

## Fuentes canónicas

- `docs/TECHNICAL_DEBT_REGISTER.md`
- `reports/architectural-hotspots.md`
- `reports/quality-metrics.md`
- `reports/system-confidence.md`
- `reports/technical-ownership-map.md`
- `scripts/config/critical-coverage-thresholds.json`
- `scripts/config/release-confidence-matrix.json`

## Streams activos del trimestre

| Stream                   | Objetivo                                                               | Señal principal de cierre                                             |
| ------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `domain-contracts`       | Reducir fan-in sobre contratos/tipos hotspot y empujar facades curadas | Menos consumers directos y boundaries más estrictos                   |
| `runtime-infrastructure` | Desacoplar servicios de runtimes singleton y mejorar testabilidad      | Servicios críticos aceptan runtime/provider explícito                 |
| `app-shell-composition`  | Mantener el shell inicial pequeño, observable y fácil de cambiar       | Menos wiring operativo en entrypoints y cobertura explícita del shell |
| `testing-governance`     | Convertir cobertura y scorecards en guardrails sostenibles             | Nuevas zonas críticas activas y reportes regenerados                  |

## Backlog priorizado

| Prioridad | Eje                      | Item                                                                             | Señal actual                                                                 | Criterio de cierre                                                                     |
| --------- | ------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `P0`      | `domain-contracts`       | Mantener `DailyRecord` y `patient` detrás de ports/facades                       | Checks de hotspot ya existen pero el fan-in sigue alto                       | Nuevos consumers solo entran por superficies curadas                                   |
| `P0`      | `testing-governance`     | Formalizar `app-shell` como zona crítica                                         | Auth bootstrap y reminders ya existen; app shell faltaba como zona explícita | `check:critical-coverage` incluye `src/app-shell` con baseline estable                 |
| `P1`      | `runtime-infrastructure` | Introducir seams inyectables en auth runtime                                     | Varias rutas de auth consumen `defaultAuthRuntime` directo                   | Helpers y servicios clave aceptan runtime explícito sin romper compatibilidad          |
| `P1`      | `domain-contracts`       | Sacar `handoffPdf` del contrato monolítico de `DailyRecord`                      | El clúster PDF solo necesita una vista parcial del registro                  | `src/services/pdf` consume `HandoffPdfRecord` y el boundary evita regresiones          |
| `P1`      | `domain-contracts`       | Sacar `census-email` y workbook maestro del contrato monolítico de `DailyRecord` | El pipeline de exportación usa un subconjunto estable del registro           | `census-email` y `exporters/excel` consumen `CensusExportRecord` con boundary blocking |
| `P1`      | `app-shell-composition`  | Mantener shell inicial separado de lógica no esencial                            | El shell concentra wiring transversal                                        | Flujo visible preservado y efectos aislados en seams específicos                       |
| `P1`      | `testing-governance`     | Mantener scorecards consistentes con nuevos owners y zonas                       | La matriz de release confidence aún no conocía `app-shell`                   | Reportes regenerados y zonas mapeadas sin huecos                                       |
| `P2`      | `runtime-infrastructure` | Reducir `console.warn/error` fuera de sinks estructurados                        | Sigue habiendo uso legacy en UI y hooks                                      | Nuevas rutas pasan por `logger`/telemetría y la deuda legacy no crece                  |

## Seams aprobados

### Dominio y contratos

- `DailyRecord`: solo puede salir por ports, read-models y facades aprobadas.
- `patient`, `auth` y tipos base de alto fan-in: consumidores nuevos deben usar contratos específicos de uso, no shapes globales amplios.
- `handoffPdf`: consume `HandoffPdfRecord` desde `src/services/pdf/contracts/handoffPdfContracts.ts` en vez de depender del contrato monolítico completo.
- `census-export`: consume `CensusExportRecord` desde `src/services/contracts/censusExportServiceContracts.ts` en workbook maestro, hidden sheets y `census-email`.
- Los boundaries de hotspot siguen siendo la fuente de verdad para imports permitidos.

### Runtime e infraestructura

- Auth, Firestore y Storage deben aceptar runtimes o providers explícitos en seams de servicio.
- La composición por defecto puede seguir existiendo, pero solo como fallback de compatibilidad.
- El runtime singleton no debe volver a crecer como dependencia obligatoria de nuevas rutas.

### App shell y composición

- El shell inicial debe consumir view-models, providers y controllers, no lógica operativa dispersa.
- La instrumentación de “shell listo” debe quedar explícita y con cobertura crítica propia.

## Gaps de coverage crítica

| Zona                           | Estado   | Acción                                                     |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `src/services/auth/bootstrap`  | `activo` | Mantener baseline y no permitir regresión                  |
| `src/features/reminders/admin` | `activo` | Mantener baseline y no permitir regresión                  |
| `src/app-shell`                | `nuevo`  | Activar baseline crítica con tests ya existentes del shell |

## Regla de ejecución por bloque

1. Levantar baseline local del hotspot o seam.
2. Cambiar una sola unidad estructural.
3. Migrar consumers o wiring indispensable.
4. Correr `typecheck`, `lint`, `check:quality` y tests focalizados.
5. Regenerar reportes impactados antes de cerrar el bloque.
