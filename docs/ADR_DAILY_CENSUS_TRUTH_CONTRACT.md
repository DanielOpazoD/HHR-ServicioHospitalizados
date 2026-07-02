# ADR: Contrato de verdad clínica del censo diario

**Estado:** Vigente (2026-07-01)
**Ámbito:** `dailyRecord` · censo diario · sincronización multi-PC · conflictos · movimientos
**Relacionado:** `ADR_DAILY_CENSUS_MOVEMENT_CONFLICT_INVARIANTS.md`, `ADR_CONFLICT_VERSION_RECOVERY.md`, `RUNBOOK_DAILY_CENSUS_RECOVERY.md`, `RUNBOOK_SYNC_RESILIENCE.md`

## Decisión

La verdad final del censo diario no es el último navegador que escribió.

Para altas, traslados, movimientos internos, CMA y cambios clínicos asociados, la verdad seleccionada
debe salir de esta cadena:

1. mutación aceptada por la autoridad transaccional del `dailyRecord`;
2. contrato de sincronización con `mutationId`, `clientId`, `tabId`, `expectedVersion`,
   `changedPaths` y claves clínicas disponibles;
3. merge por intención clínica cuando hay conflicto;
4. invariantes post-merge que impiden perder movimientos visibles, duplicar pacientes activos en
   camas, revivir tombstones o borrar snapshot clínico relevante como diagnóstico.

Esta regla reemplaza cualquier interpretación de `last write wins` para el censo diario. El timestamp
del navegador puede ordenar intentos, pero no decide por sí solo la verdad clínica.

## Contrato explícito

| Capa                   | Responsabilidad                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Autoridad clínica      | Acepta o rechaza la mutación contra versión esperada y reglas de dominio.                                             |
| Sync contract          | Transporta identidad de mutación y contexto semántico para que el replay tras reinicio sea idempotente.               |
| Merge de conflicto     | Fusiona intención clínica por dominio: camas como estado actual; altas, traslados y CMA como bitácoras por identidad. |
| Invariantes post-merge | Validan que lo visible y lo auditado no se separen de forma peligrosa.                                                |
| Observabilidad         | Explica qué ganó, qué quedó protegido y por qué, sin exponer identificadores crudos de cliente o pestaña.             |
| UI de recuperación     | Explica si no hay versiones porque no se guardaron, expiraron por TTL, faltó permiso o no existe evidencia.           |

## Reglas no negociables

- Una alta aceptada no puede quedar solo como evento de auditoría si corresponde a `discharges[]`.
- Un traslado o CMA aceptado no puede perderse por replay de una sesión stale.
- Un movimiento interno no puede dejar el mismo paciente activo en dos camas.
- Un tombstone de movimiento no puede revivir por merge posterior.
- El diagnóstico y snapshot clínico relevante deben preservarse al mover cama.
- La recuperación desde snapshots es operativa y temporal; no reemplaza el contrato de verdad.

## Evidencia mínima

El PR que toque esta zona debe mantener:

- test multi-PC/restart con dos clientes lógicos, outbox pendiente y replay stale;
- cobertura de altas, traslados, movimientos internos y CMA;
- checker post-merge de invariantes;
- narrativa de observabilidad con `conflictResolutionSummary`;
- UI de conflictos con causa concreta de ausencia de snapshots;
- runbook operacional actualizado.

El gate `check:daily-record-truth-contract` verifica que estas piezas sigan presentes.

## Fuera de alcance

- Reescribir el censo completo como event sourcing.
- Exponer identificadores crudos de navegador en UI clínica.
- Mantener snapshots de conflicto indefinidamente. Para eso existe historial permanente y auditoría.
