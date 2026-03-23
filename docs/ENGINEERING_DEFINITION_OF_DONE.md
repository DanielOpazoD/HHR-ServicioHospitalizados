# Engineering Definition Of Done

Una change queda lista solo si cumple todo lo siguiente:

1. `npm run typecheck`, `npm run lint`, `npm run check:quality` y `npm run build` pasan en verde.
2. No introduce warnings en `src/`.
3. Si toca flujos críticos, agrega o ajusta tests automatizados.
4. Si cambia boundaries, wiring o contratos, actualiza documentación/ADR en la misma change.
5. No agrega bypasses a `application`, `shared/access` ni providers obligatorios.
6. No deja excepciones abiertas sin owner, motivo y criterio de cierre documentados.
7. Si toca un subsistema crítico, mantiene actualizado `scripts/config/technical-ownership-map.json` con owner, gate y runbook vigentes.
