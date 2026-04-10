# HHR Hospital Tracker - Estado del Proyecto

> **Última actualización:** 2026-04-10
> **Evaluación técnica de referencia:** 6.4 / 7.0

## Resumen

El proyecto se encuentra en un estado **bueno y operable**, con una base técnica robusta para un sistema clínico: tipado estricto en código fuente, checks de arquitectura, suite amplia de tests y cobertura de flujos críticos con emuladores y E2E.

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

- Métricas actuales: [reports/quality-metrics.md](reports/quality-metrics.md)
- Pipeline activa: [ci-cd.yml](.github/workflows/ci-cd.yml)
