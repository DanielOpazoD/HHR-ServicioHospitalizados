# Runbook: recuperación de incidentes del censo diario

**Ámbito:** censo diario, altas, movimientos de cama, conflictos auto-mergeados.
**Uso:** cuando observabilidad y censo visible no coinciden, o cuando el panel de versiones en
conflicto no muestra evidencia recuperable.

## Triage inicial

1. Confirmar fecha clínica afectada (`dailyRecord.date`).
2. Identificar el paciente por nombre y RUT/documento.
3. Revisar observabilidad por:
   - `PATIENT_DISCHARGED`
   - `PATIENT_MODIFIED` / `PATIENT_BED_CHANGED`
   - `CONFLICT_AUTO_MERGED`
   - `CONFLICT_VERSION_RESTORED`
4. Comparar estado visible del daily record:
   - `beds[bedId]`
   - `discharges[]`
   - `transfers[]`
   - `cma[]`

## Si el diagnóstico desaparece tras mover cama

1. Revisar el evento de movimiento y confirmar `sourceBed`, `targetBed`, `patientName`,
   `patientRut` y `diagnosis`.
2. Revisar que el paciente en la cama destino conserve `pathology`.
3. Si hubo conflicto posterior, revisar el evento `CONFLICT_AUTO_MERGED`:
   - `sampleDecisions`
   - `changedPaths`
   - `snapshotRecovery`
4. Si el estado visible perdió el diagnóstico, restaurar desde snapshot solo si el panel muestra una
   versión recuperable y la restauración es clínicamente aprobada.

## Si el alta existe en observabilidad pero no aparece en altas del día

1. Confirmar que el evento `PATIENT_DISCHARGED` no es la única fuente de verdad.
2. Buscar la fila esperada en `discharges[]` por:
   - `id`
   - `rut`
   - `patientName`
   - `movementDate`
3. Si falta la fila y hubo conflicto, revisar si el merge descartó un movimiento local nuevo.
4. Reconstruir la fila desde el snapshot `originalData` o desde la versión pre-merge si está
   recuperable.
5. Registrar cualquier restauración o reparación manual como acción auditada.

## Si el panel de conflictos no muestra versiones

Interpretar el estado del panel:

- **Snapshots recuperables:** existe al menos una versión que puede restaurarse.
- **Snapshots no guardados:** el conflicto ocurrió, pero la captura best-effort falló.
- **Snapshots no disponibles:** fueron guardados, pero ya expiraron por TTL, fueron purgados o el
  usuario actual no tiene acceso.
- **Sin snapshots recuperables:** no hay evidencia operativa disponible en la ventana actual.

En todos los casos, la auditoría permanente debe seguir disponible aunque el snapshot recuperable
haya expirado.

## Validación después de reparar

Ejecutar como mínimo:

```bash
npx vitest run src/tests/services/repositories/dailyRecordCensusIncidentRegression.test.ts \
  src/tests/services/repositories/conflictResolutionMovementDeletionPolicy.test.ts \
  src/tests/services/storage/dailyRecordConflictSnapshotService.test.ts \
  src/tests/views/census/conflictVersionsPresentationController.test.ts
```

Para cierre de PR:

```bash
npm run typecheck
npm run lint:strict:core
npm run check:quality:group -- size
npm run check:quality:group -- tests
```
