# ADR: Clinical Episode Model

**Estado:** Vigente

## Decisión

El identificador y contexto de episodio clínico pasan a resolverse desde un modelo compartido en `src/application/patient-flow/clinicalEpisode.ts`.

## Motivo

El `episodeKey` y la semántica de ingreso nuevo estaban duplicados entre censo, documentos clínicos y otras vistas derivadas.

## Consecuencia

- Censo y documentos clínicos usan la misma fuente de verdad para episodio.
- Los indicadores clínicos y movimientos del día comparten semántica.
- Nuevos módulos deben reutilizar este modelo en vez de reconstruir `episodeKey` localmente.
