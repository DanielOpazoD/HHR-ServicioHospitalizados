# Foundation Continuation Tracker

Última actualización: 2026-04-09

## Resumen

- Ciclo activo: `Q00-Q07`
- Tareas resueltas o no requeridas: `4/8`
- Estado global del ciclo: `50%`

## Regla activa

- No se inicia una fase nueva hasta cerrar completamente la actual.
- Toda fase cerrada debe dejar commit dedicado, tracker actualizado y checks de salida en verde.

## Estado actual del ciclo `Q00-Q07`

| Id    | Estado     | Nota                                                                                                                                                                                                                                           |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Q00` | completado | plan iterativo abierto en `docs/ITERATIVE_QUALITY_EXECUTION_PLAN.md` y deuda registrada                                                                                                                                                        |
| `Q01` | completado | `feature-dependency-matrix`, `test-failure-catalog` y artefactos `reports/*` quedaron alineados; checks de salida en verde                                                                                                                     |
| `Q02` | completado | los shims de compatibilidad de `census` quedaron gobernados explícitamente, `sharedCensusBrowserRuntimeController` ya usa el adapter del feature y la única excepción restante `components -> laboratory/public` quedó inventariada para `Q05` |
| `Q03` | completado | los casos de uso de `clinical-documents` ya consumen contratos internos en lugar de reingresar por `index/public`, `patient-flow` consolidó `Conflict` en el engine y `check:architecture` más `typecheck` quedaron en verde                   |
| `Q04` | pendiente  | alinear `repo-hygiene` y `domain-hotspot-boundary` con contratos canónicos de `dailyRecord`                                                                                                                                                    |
| `Q05` | pendiente  | consolidar entrypoints públicos por feature                                                                                                                                                                                                    |
| `Q06` | pendiente  | redefinir PIN local como barrera UX explícita                                                                                                                                                                                                  |
| `Q07` | pendiente  | corrida final, cierre documental y convergencia                                                                                                                                                                                                |

## Historial del ciclo previo `N01-N15`

| Id    | Estado                 | Nota                                                                                                                                             |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `N01` | completado             | `folder dependency debt` bajó a `0`; el antiguo `hooks -> features` quedó reclasificado como compatibilidad gobernada                            |
| `N02` | completado             | La causa real del debt era un bloque único de `25` shims en `src/hooks/controllers`                                                              |
| `N03` | no requerido por ahora | No se detectaron cruces impropios adicionales tras separar shims gobernados de deuda real                                                        |
| `N04` | completado             | `release confidence` volvió a `ok` al mapear `src/services/backup` en `export_and_backup`                                                        |
| `N05` | completado             | Baseline de `release confidence` y `quality metrics` regenerado y alineado                                                                       |
| `N06` | completado             | `minsalStatsCalculator.test.ts` quedó repartido entre `ranges-and-snapshots`, `aggregate-stats` y `stay-resolution`                              |
| `N07` | completado             | `firestore-rules.test.ts` quedó reducido a un entrypoint con harness común y grupos separados por dominio                                        |
| `N08` | completado             | `flake-risk files` bajó a `0` al eliminar el `Date.now()` no determinista de `auditViewThrottle.test.ts`                                         |
| `N09` | completado             | `check:domain-hotspot-boundary` volvió a verde al retirar el import directo residual desde `shared/census`                                       |
| `N10` | completado             | `reports/quality-metrics` ahora mide `raw console warn/error outside structured sink` y el valor quedó en `0`                                    |
| `N11` | completado             | `ApplicationOutcome` y sus helpers pasaron a `shared/contracts`; ya no quedan imports productivos a `application/shared/applicationOutcome*`     |
| `N12` | completado             | `docs/TECHNICAL_DEBT_REGISTER.md` quedó alineado con el estado actual; `census-type-drift` se cerró con `typecheck` verde y tests en API vigente |
| `N13` | completado             | `reports/quality-metrics` y baseline asociado se regeneraron tras cada ola estructural reciente y reflejan el estado actual                      |
| `N14` | completado             | Se sostuvieron dos ciclos reales de cadencia con nuevas olas `P2` sobre `CensusTable` y `TransferManagementView`, manteniendo gates verdes       |
| `N15` | completado             | Reevaluación de cierre ejecutada con métricas vigentes, gates verdes y deuda residual ya acotada a mantenimiento normal                          |

## Señal actual

- `typecheck`: `ok`
- `check:quality`: `failing`
- focos activos: `dailyRecord canonical contracts`, `feature public APIs`, `local PIN UX copy`, `convergencia final`

## Siguiente paso recomendado

1. Ejecutar `Q04` completo antes de abrir consolidación de APIs públicas
2. Mantener la excepción `components -> laboratory/public` congelada hasta `Q05`
3. Cerrar cada fase actualizando este tracker y el plan iterativo
