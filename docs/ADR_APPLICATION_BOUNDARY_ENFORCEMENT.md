# ADR: Boundary de Application como Contrato Preferente

**Estado:** Vigente

## Decisión

Los flujos críticos de UI deben preferir casos de uso/fachadas de `src/application/*` y outcomes homogéneos antes que acceso directo a servicios remotos o repositorios concretos.

## Motivo

La base ya tenía `ApplicationOutcome` y puertos explícitos, pero seguían existiendo puntos de entrada mixtos que aumentaban acoplamiento y hacían más difícil estabilizar errores, permisos y telemetría.

## Consecuencia

- Los outcomes críticos deben salir tipados y consistentes.
- Los servicios de infraestructura no se convierten en APIs públicas de UI por defecto.
- Los boundaries automáticos del repo pasan a reflejar una decisión arquitectónica explícita.
