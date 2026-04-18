# HHR Hospital Tracker - Estado del Proyecto

> **Última actualización:** 2026-04-17

## Métricas objetivas

Cifras verificables en el repo a la fecha de actualización. No se incluye una nota global auto-asignada: la evaluación técnica debe derivarse de estas métricas, no de un número resumen.

| Métrica                             | Valor           | Fuente                                                          |
| ----------------------------------- | --------------- | --------------------------------------------------------------- |
| Archivos `.ts`/`.tsx` en `src/`     | 2.858           | `find src -type f \( -name "*.ts" -o -name "*.tsx" \) \| wc -l` |
| Archivos de test (unit/integration) | 1.003           | `find src -name "*.test.*" -o -name "*.spec.*" \| wc -l`        |
| Specs E2E Playwright                | ver `e2e/`      | `ls e2e/*.spec.ts`                                              |
| `TODO`/`FIXME`/`HACK` en `src/`     | 3               | `grep -rE "TODO\|FIXME\|HACK" src`                              |
| Vulnerabilidades npm (runtime)      | 0               | `npm audit --omit=dev`                                          |
| Vulnerabilidades npm (dev-only)     | ver `npm audit` | transitivas en tooling                                          |
| Features activas                    | 13              | `ls src/features/`                                              |

Cobertura de tests, presupuesto de bundle y checks de arquitectura viven en CI (`ci-cd.yml`). Si se necesita una nota ejecutiva, debe venir de una auditoría externa fechada, no de una autoevaluación sin evidencia.

## Resumen

El proyecto es **operable y robusto para uso clínico**: tipado estricto, checks de arquitectura automatizados, suite amplia de tests y cobertura de flujos críticos con emuladores y E2E. Riesgos residuales conocidos en la sección "Deuda técnica principal".

Las mejoras recientes se han concentrado en:

- eliminar rutas Gemini cliente no utilizadas;
- modularizar `functions/index.js` en dominios internos;
- reducir imports de compatibilidad desde `dataService.ts`;
- limpiar artefactos trackeados y endurecer la higiene del repositorio;
- cerrar el roadmap estructural `B01-B26` y dejar cadencia mensual de convergencia.

## Fortalezas actuales

- Arquitectura orientada por features y servicios.
- Controles automáticos de calidad y boundaries.
- Estrategia offline-first con respaldo de Firestore/IndexedDB.
- Suite de tests amplia para riesgos clínicos y operativos.

## Deuda técnica principal

- Complejidad estructural alta en módulos críticos de runtime y storage.
- Compatibilidad legacy todavía necesaria como protección de migración hasta que la app sea oficial, con costo de mantenimiento controlado.
- Documentación técnica histórica que puede desalinearse si no se regenera con disciplina.
- Features experimentales presentes en el repo, aunque ya no expuestas en el acceso principal.

## Próximo foco recomendado

1. Mantener verdes `typecheck`, `lint`, `check:quality`, build y cobertura crítica.
2. Mantener documentación canónica y READMEs sin rutas absolutas locales.
3. Mantener la convergencia con la rutina de [docs/FOUNDATION_MAINTENANCE_CADENCE.md](docs/FOUNDATION_MAINTENANCE_CADENCE.md).
4. No cerrar compatibilidades legacy de auth/roles/rules hasta que la app sea oficial y exista auditoría de producción sin consumidores activos.

## Tracker de cimientos

El seguimiento persistente del roadmap estructural vive en:

- [docs/FOUNDATION_TRACKER.md](docs/FOUNDATION_TRACKER.md)
- Taxonomía canónica: [docs/CODEBASE_CANON.md](docs/CODEBASE_CANON.md)
- Mapa documental: [docs/DOCUMENTATION_MAP.md](docs/DOCUMENTATION_MAP.md)

## Fuente de verdad

- Pipeline activa: [ci-cd.yml](.github/workflows/ci-cd.yml)
- Reportes generados: [reports/](reports/) (runtime-contracts, legacy-bridge-governance)
