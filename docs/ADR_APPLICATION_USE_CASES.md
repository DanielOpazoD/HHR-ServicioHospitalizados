# ADR: Application Use Cases

**Estado:** Vigente

## Decisión

Se introduce `src/application/` como capa explícita para operaciones críticas que coordinan repositorios, clasificación de errores y outcomes homogéneos.

## Motivo

La lógica importante estaba demasiado repartida entre hooks, controllers y repositorios. Eso dificultaba reutilizar reglas, exponer outcomes consistentes y probar flujos clínicos completos.

## Consecuencia

- Los hooks siguen existiendo como adaptadores de UI.
- Los casos de uso críticos viven en `src/application/*`.
- Los repositorios mantienen contratos de infraestructura.
- Los outcomes de aplicación son la interfaz preferida para sync, inicialización y flujos clínicos críticos.
