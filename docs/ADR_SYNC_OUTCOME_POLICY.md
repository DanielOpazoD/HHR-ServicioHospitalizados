# ADR: Sync Outcome Policy

**Estado:** Vigente

## Decisión

Las operaciones remotas críticas deben exponer outcomes de aplicación homogéneos (`success | partial | degraded | failed`) antes de llegar a la UI.

## Motivo

Existían respuestas heterogéneas (`clean`, `blocked`, `missing`, `null`, excepciones) que obligaban a cada consumidor a reinterpretar estados remotos.

## Consecuencia

- `syncWithFirestoreDetailed` sigue siendo contrato de repositorio.
- La UI consume preferentemente use-cases que traducen esos resultados a `ApplicationOutcome`.
- Los mensajes de degradación y fallback se centralizan mejor y son más testeables.
