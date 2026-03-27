# `src/features/handoff`

## Proposito

Entrega de turno de enfermeria y medicos, con flujos de gestion, delivery y handoff medico por paciente.

## Decision Guide

- Superficies runtime y puntos de cambio seguros: [docs/ADR_HANDOFF_RUNTIME_SURFACES.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/ADR_HANDOFF_RUNTIME_SURFACES.md)
- Checklist transversal de cambio seguro: [docs/SAFE_CHANGE_CHECKLIST.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/SAFE_CHANGE_CHECKLIST.md)

## Estructura

- `components/`: shell visual y vistas de handoff.
- `hooks/`: screen models/runtime hooks para aislar wiring grande de las vistas.
- `controllers/`: policies de pantalla, adapters internos y bridges deprecated inventariados.
- `application/handoff`: use cases y read models del contexto.
- `domain/handoff`: reglas puras de entries, management y vistas.

## Contratos principales

- La logica de negocio nueva entra en `application/handoff` o `domain/handoff`.
- Los controllers de pantalla (`handoffViewController`, `handoffViewBindingsController`,
  `handoffMedicalContentController`, `clinicalEventsPanelController`) concentran wiring puro,
  presentation policy y payload normalization; la UI no debe reabsorber esas decisiones.
- Los controllers deprecated solo mantienen compatibilidad temporal; no deben recibir logica nueva.
- Los resultados operativos de gestion y delivery deben salir como `ApplicationOutcome`.
- El source productivo no debe importar el barrel `features/handoff/controllers` ni los bridges deprecated.

## Invariantes

- El mirroring legacy de ciertos campos medicos debe preservarse mientras existan consumers antiguos.
- Los read models de pantalla deben alimentar la UI; no reinyectar decisiones de negocio en `.tsx`.
- `HandoffView.tsx` debe mantenerse presentacional; la coordinacion de contexts, auth, audit y
  bindings de pantalla debe salir por hooks locales del feature como `useHandoffViewScreenModel`.
- `useHandoffViewScreenModel` no debe volver a mezclar efectos de auditoria, `document.title`,
  rules de read-only e inicializacion desde URL en el mismo bloque sin controller intermedio.
- `ClinicalEventsPanel.tsx` debe limitarse a estado local de UI; sorting, defaults y normalizacion
  del formulario deben salir por `clinicalEventsPanelController.ts`.
- Los flows de firma, continuidad y patient entries deben seguir auditando con payload compatible.
- Los bridges deprecated quedan permitidos solo para compatibilidad de tests o adapters inventariados.
- Cuando una entrega medica se copia al dia siguiente, el contenido se hereda pero la vigencia diaria no:
  `currentStatus*` debe reiniciarse para que la UI muestre "pendiente hoy" hasta nueva confirmacion
  o actualizacion del especialista.
- `doctor_specialist` puede editar solo la entrega del dia actual; dias previos deben quedar en solo lectura
  tanto en la UI como en la capa de mutacion.

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
- `src/features/handoff/public.ts`

## Controllers activos recomendados

- [handoffViewController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/features/handoff/controllers/handoffViewController.ts)
  para frame de pantalla, audit descriptor y bindings del shell.
- [handoffViewBindingsController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/features/handoff/controllers/handoffViewBindingsController.ts)
  para acciones medicas y eventos clinicos con gating por capabilities.
- [handoffMedicalContentController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/features/handoff/controllers/handoffMedicalContentController.ts)
  para filtros/chips y links de handoff medico.
- [clinicalEventsPanelController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/features/handoff/controllers/clinicalEventsPanelController.ts)
  para defaults, sorting y payload del panel de eventos clinicos.

El consumo externo a la feature debe entrar por `public.ts` o `index.ts`. Los imports profundos a
`components/`, `controllers/` o bridges internos quedan reservados para implementación interna del
feature.

## Checks recomendados

- `npm exec -- vitest run src/tests/application/handoff src/tests/domain/handoff src/tests/hooks/controllers`
- `npx vitest run src/tests/views/handoff`
- `npm run check:handoff-context-boundaries`
- `npm run check:quality`
- `npm run typecheck`
