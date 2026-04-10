# Technical Execution Baseline

Generated at: 2026-04-10T00:27:12.779Z

## Canonical Sources

- `docs/FOUNDATION_TRACKER.md`
- `docs/FOUNDATION_MAINTENANCE_CADENCE.md`
- `docs/TECHNICAL_DEBT_REGISTER.md`
- `reports/architectural-hotspots.md`
- `reports/quality-metrics.md`
- `reports/system-confidence.md`
- `reports/technical-ownership-map.md`
- `scripts/config/critical-coverage-thresholds.json`
- `scripts/config/release-confidence-matrix.json`

## Streams

| Stream                    | Goal                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `domain-contracts`        | Reducir fan-in sobre contratos y tipos hotspot mediante facades y ports            |
| `runtime-infrastructure`  | Extender seams inyectables y reducir dependencia obligatoria de singletons runtime |
| `app-shell-composition`   | Mantener el shell inicial pequeño, observable y con boundaries explícitos          |
| `testing-governance`      | Ampliar critical coverage y alinear scorecards/reportes con el trabajo estructural |
| `foundations-convergence` | Mantener APIs públicas, shims, megatests y ownership en convergencia sostenida     |

## Prioritized Backlog

| Id                                   | Priority | Stream                    | Closure signal                                                                                               |
| ------------------------------------ | -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `census-unified-rows-test-alignment` | P0       | `foundations-convergence` | typecheck vuelve a verde y las suites de census dejan de depender de occupiedRows/emptyBeds                  |
| `app-shell-critical-coverage`        | P0       | `testing-governance`      | check:critical-coverage incluye src/app-shell con baseline estable                                           |
| `auth-runtime-seams`                 | P1       | `runtime-infrastructure`  | Seams clave de auth aceptan runtime explícito sin romper compatibilidad                                      |
| `foundation-monthly-cadence`         | P1       | `foundations-convergence` | Cada ciclo ejecuta al menos una baja de shim, un hotspot y una partición de megatest con tracker actualizado |
| `next-megatest-wave`                 | P1       | `testing-governance`      | PatientRowOrbitalQuickActions y transferService quedan partidos por seams concretos                          |
| `legacy-console-reduction`           | P2       | `runtime-infrastructure`  | No crecen usos legacy de console.warn/error fuera de sinks estructurados                                     |
