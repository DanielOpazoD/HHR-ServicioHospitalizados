# `src/features/handoff`

## Proposito

Entrega de turno de enfermeria y medicos, con flujos de gestion, delivery y handoff medico por paciente.

## Estructura

- `components/`: shell visual y vistas de handoff.
- `controllers/`: bridges deprecated y algunos adapters de compatibilidad.
- `application/handoff`: use cases y read models del contexto.
- `domain/handoff`: reglas puras de entries, management y vistas.

## Contratos principales

- La logica de negocio nueva entra en `application/handoff` o `domain/handoff`.
- Los controllers deprecated solo mantienen compatibilidad temporal; no deben recibir logica nueva.
- Los resultados operativos de gestion y delivery deben salir como `ApplicationOutcome`.
- El source productivo no debe importar el barrel `features/handoff/controllers` ni los bridges deprecated.

## Invariantes

- El mirroring legacy de ciertos campos medicos debe preservarse mientras existan consumers antiguos.
- Los read models de pantalla deben alimentar la UI; no reinyectar decisiones de negocio en `.tsx`.
- Los flows de firma, continuidad y patient entries deben seguir auditando con payload compatible.
- Los bridges deprecated quedan permitidos solo para compatibilidad de tests o adapters inventariados.

## Bridges activos

- `handoffManagementController.ts`
- `medicalPatientHandoffController.ts`
- `medicalPatientHandoffMutationController.ts`
- `handoffScreenController.ts`
- `medicalPatientHandoffViewController.ts`
- `medicalPatientHandoffRenderController.ts`

## Entry points recomendados

- `src/application/handoff`
- `src/domain/handoff/management.ts`
- `src/domain/handoff/patientEntries.ts`
- `src/domain/handoff/patientEntryMutations.ts`
- `src/domain/handoff/patientView.ts`
- `src/domain/handoff/view.ts`
- `src/domain/handoff/scope.ts`

## Checks recomendados

- `npm exec -- vitest run src/tests/application/handoff src/tests/domain/handoff src/tests/hooks/controllers`
- `npm run check:handoff-context-boundaries`
- `npm run check:quality`
- `npm run typecheck`
