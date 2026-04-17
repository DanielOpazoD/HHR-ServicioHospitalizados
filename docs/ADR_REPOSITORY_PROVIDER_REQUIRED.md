# ADR: Repository Provider Obligatorio

**Estado:** Vigente

## Decisión

`RepositoryProvider` pasa a ser obligatorio en runtime y en tests. `useRepositories()` ya no cae a implementaciones concretas por omisión.

## Motivo

El fallback implícito escondía wiring incompleto, mezclaba bootstrap con ejecución normal y hacía que algunos tests dependieran del estado global del módulo sin declararlo.

## Consecuencia

- La app debe montar `RepositoryProvider` explícitamente.
- Los tests usan `createTestRepositoryContainer()` o wrappers dedicados para inyectar dobles.
- La ausencia del provider falla rápido y de forma visible.
