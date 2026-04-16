# Evaluación de Módulo: Entrega de Turno Enfermería

## Metadatos del módulo

- **Módulo:** Entrega de turno enfermería
- **Ruta(s) principal(es):**
  - [src/features/handoff](../src/features/handoff)
  - [src/application/handoff](../src/application/handoff)
  - [src/domain/handoff](../src/domain/handoff)
  - [src/hooks/useHandoffLogic.ts](../src/hooks/useHandoffLogic.ts)
- **Fecha de evaluación:** 2026-04-15
- **Evaluador:** Codex
- **Estado general:** verde

---

## 1. Nota global

- **Nota global (1 a 7):** `6.6 / 7`
- **Resumen ejecutivo breve:** submódulo fuerte, bien probado y bastante estable para un frente clínico-operativo de uso muy frecuente. La base de negocio y persistencia está bien resuelta, y la UI específica de enfermería es relativamente compacta. Tras la ronda actual, checklist/staff y novedades quedaron más declarativos; lo que le impide subir más ya no es deuda roja, sino que todavía comparte bastante wiring con el shell general de `handoff`, especialmente en `useHandoffLogic` y `useHandoffViewScreenModel`.

---

## 2. Evaluación multiparamétrica

| Dimensión                        | Nota | Comentario                                                                                   |
| -------------------------------- | ---: | -------------------------------------------------------------------------------------------- |
| Calidad general                  |  6.6 | Muy buen nivel para un módulo transversal, sensible y muy usado.                             |
| Estructura                       |  6.6 | Buena separación entre `feature`, `application`, `domain` y hooks de pantalla.               |
| Organización                     |  6.4 | La parte enfermería está ordenada, pero comparte bastante superficie con el handoff general. |
| Buenas prácticas de codificación |  6.6 | Buen uso de use cases, domain builders y read models.                                        |
| Coherencia funcional             |  6.6 | Checklist, novedades, staff y movimientos están bien alineados con la lógica de turno.       |
| Separación y límites             |  6.5 | Aceptable, pero parte del wiring aún vive en hooks compartidos con el frente médico.         |
| Estabilidad                      |  6.6 | La batería focalizada está completamente verde y cubre pantalla, lógica y use cases clave.   |
| Escalabilidad                    |  6.3 | Puede crecer, aunque conviene aislar mejor concerns de enfermería del runtime compartido.    |
| Documentación                    |  6.6 | El frente `handoff` está bien documentado y eso también beneficia a enfermería.              |
| Tests                            |  6.7 | Cobertura buena y diversa entre vistas, hooks y `application`.                               |

---

## 3. Qué hace bien este módulo

- Tiene una base documental sólida compartida con el frente handoff:
  - [src/features/handoff/README.md](../src/features/handoff/README.md)
  - [docs/ADR_HANDOFF_RUNTIME_SURFACES.md](./ADR_HANDOFF_RUNTIME_SURFACES.md)
- La lógica de persistencia crítica no está enterrada en JSX:
  - [src/application/handoff/handoffManagementUseCases.ts](../src/application/handoff/handoffManagementUseCases.ts)
  - [src/domain/handoff/management.ts](../src/domain/handoff/management.ts)
- La UI específica de enfermería es relativamente compacta y legible:
  - [src/features/handoff/components/HandoffNursingContent.tsx](../src/features/handoff/components/HandoffNursingContent.tsx)
  - [src/features/handoff/components/HandoffChecklistSection.tsx](../src/features/handoff/components/HandoffChecklistSection.tsx)
  - [src/features/handoff/components/HandoffNovedades.tsx](../src/features/handoff/components/HandoffNovedades.tsx)
- La suite focalizada cubre bien la experiencia de turno, checklist, novedades y lógica asociada.
- El primer bloque de saneamiento ya sacó dos decisiones operativas del render:
  - `buildHandoffChecklistSectionViewModel(...)`
  - `buildHandoffNovedadesBindings(...)`
- El resumen de movimientos ahora también consume un view-model explícito en vez de resolver filtrados y mensajes directamente en el componente:
  - `buildMovementsSummaryViewModel(...)`
- El runtime compartido de enfermería también quedó algo más ordenado:
  - `buildNursingNoteChangePlan(...)`
  - `buildHandoffLogicViewState(...)`

---

## 4. Hallazgos principales

- El submódulo de enfermería está más sano que muchos otros frentes del repo y no muestra una deuda estructural urgente.
- La principal fricción no está en los componentes específicos de enfermería, sino en que dependen de un runtime compartido bastante ancho:
  - [src/hooks/useHandoffLogic.ts](../src/hooks/useHandoffLogic.ts)
  - [src/features/handoff/hooks/useHandoffViewScreenModel.ts](../src/features/handoff/hooks/useHandoffViewScreenModel.ts)
- La lógica de checklist, novedades y staff está bien resuelta en dominio/application, pero el ensamblaje final de pantalla sigue compartiendo demasiados concerns entre enfermería y medicina.
- `MovementsSummary` es valioso, pero ya tiene suficiente tamaño como para vigilarlo:
  - [src/features/handoff/components/MovementsSummary.tsx](../src/features/handoff/components/MovementsSummary.tsx)
- La ronda actual mejoró la legibilidad del shell de enfermería sin abrir más capas: checklist y novedades ahora consumen bindings/view-models explícitos.
- El frente de movimientos también quedó mejor protegido con pruebas directas del controller, no solo con pruebas DOM del componente.
- La ronda más reciente quitó otra pequeña composición/manualidad del runtime compartido sin cambiar el contrato del hook principal.

---

## 5. Riesgos actuales

### Riesgo técnico

- Seguir agregando lógica de enfermería dentro de hooks compartidos (`useHandoffLogic`, `useHandoffViewScreenModel`) en lugar de convergerla por pequeños read models/controladores.
- Mezclar más reglas de turno de enfermería con concerns médicos, CUDYR o impresión en el mismo nivel de orquestación.

### Riesgo operativo / clínico

- Regresiones en:
  - checklist de turno
  - novedades día/noche
  - staff que entrega / recibe
  - shortcut nocturno a CUDYR
  - resumen de movimientos visibles por turno

---

## 6. Hotspots y archivos clave

| Archivo                                                                                                                       | Rol                                    | Riesgo / observación                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| [src/hooks/useHandoffLogic.ts](../src/hooks/useHandoffLogic.ts)                                                               | Hook runtime compartido                | `205` líneas; mezcla lógica de enfermería, medicina, comunicación y eventos.      |
| [src/features/handoff/hooks/useHandoffViewScreenModel.ts](../src/features/handoff/hooks/useHandoffViewScreenModel.ts)         | Composition root del feature           | `246` líneas; todavía carga bastante wiring de pantalla compartido.               |
| [src/domain/handoff/management.ts](../src/domain/handoff/management.ts)                                                       | Builders/patches de gestión handoff    | `331` líneas; central y bien diseñada, pero muy sensible por impacto transversal. |
| [src/application/handoff/handoffManagementUseCases.ts](../src/application/handoff/handoffManagementUseCases.ts)               | Use cases de checklist/novedades/staff | `289` líneas; buen diseño, aunque ya concentra bastante coordinación.             |
| [src/features/handoff/components/MovementsSummary.tsx](../src/features/handoff/components/MovementsSummary.tsx)               | Resumen visual de movimientos          | `194` líneas; componente útil pero con suficiente peso como para seguir vigilado. |
| [src/features/handoff/components/HandoffChecklistSection.tsx](../src/features/handoff/components/HandoffChecklistSection.tsx) | Shell visual de checklist/staff        | Compacto y sano, pero es punto sensible por UX de día/noche y staff.              |

---

## 7. Guardrails y checks relevantes

- `npx vitest run src/tests/views/handoff/HandoffView.test.tsx src/tests/views/handoff/HandoffHeader.test.tsx src/tests/views/handoff/handoffViewController.test.ts src/tests/views/handoff/handoffManagementController.test.ts src/tests/hooks/useHandoffLogic.nursing-and-events.test.ts src/tests/application/handoff/handoffManagementUseCases.test.ts`
- `npm run check:handoff-context-boundaries`
- `npm run check:quality`
- `npm run typecheck`

Resultado actual de esta evaluación:

- **Tests focalizados de enfermería/handoff:** `6/6` archivos verdes, `45/45` tests OK
- **Ronda adicional de movimientos:** `5/5` archivos verdes, `34/34` tests OK
- **Ronda adicional de runtime compartido:** `7/7` archivos verdes, `37/37` tests OK
- **Handoff context boundaries:** verde
- **Typecheck después de la ronda:** verde

En la ronda actual sí hubo cambios de código focalizados, y el frente mantuvo tests, boundaries y `typecheck` en verde.

---

## 8. Deuda técnica priorizada

### P1

- Seguir separando concerns de enfermería del runtime compartido de `handoff`.
- Evitar que `useHandoffLogic.ts` siga absorbiendo coordinación nueva de pantalla.

### P2

- Reducir un poco más la densidad de:
  - `handoffManagementUseCases.ts`
  - `management.ts`
  - `MovementsSummary.tsx`

### P3

- Seguir formalizando como read models las pequeñas reglas visuales de turno, staff y movimientos cuando aparezca churn nuevo.

---

## 9. Plan de mejoras por bloques

### Bloque 1

- **Objetivo:** bajar algo de coordinación compartida del runtime del módulo.
- **Cambio esperado:** extraer 1-2 policies pequeñas de enfermería desde `useHandoffLogic.ts` hacia helpers/controllers puros.
- **Estado actual:** parcialmente completado; checklist y novedades ya tienen bindings más explícitos fuera del render.
- **Avance adicional:** el cambio de nota de enfermería y el estado derivado visible del hook ahora usan contratos puros más explícitos.
- **Archivos probables:**
  - [src/hooks/useHandoffLogic.ts](../src/hooks/useHandoffLogic.ts)
  - [src/features/handoff/controllers/handoffViewController.ts](../src/features/handoff/controllers/handoffViewController.ts)
- **Tests / checks requeridos:**
  - `src/tests/hooks/useHandoffLogic.nursing-and-events.test.ts`
  - `src/tests/views/handoff/handoffViewController.test.ts`
  - `npm run check:handoff-context-boundaries`
- **Criterio de cierre:** menos branching incidental compartido en el hook principal.

### Bloque 2

- **Objetivo:** consolidar mejor el frente de checklist/staff.
- **Cambio esperado:** extraer una pequeña política visual/operativa de `HandoffChecklistSection.tsx` si ayuda a reducir decisiones inline.
- **Archivos probables:**
  - [src/features/handoff/components/HandoffChecklistSection.tsx](../src/features/handoff/components/HandoffChecklistSection.tsx)
  - [src/application/handoff/handoffManagementUseCases.ts](../src/application/handoff/handoffManagementUseCases.ts)
  - [src/domain/handoff/management.ts](../src/domain/handoff/management.ts)
- **Tests / checks requeridos:**
  - `src/tests/views/handoff/handoffManagementController.test.ts`
  - `src/tests/application/handoff/handoffManagementUseCases.test.ts`
- **Criterio de cierre:** checklist y staff más declarativos sin duplicar reglas de turno.

### Bloque 3

- **Objetivo:** bajar algo de densidad del resumen de movimientos y novedades.
- **Cambio esperado:** aislar una policy de render/summary de `MovementsSummary.tsx` o `HandoffNursingContent.tsx`.
- **Estado actual:** parcialmente completado con `buildMovementsSummaryViewModel(...)`.
- **Archivos probables:**
  - [src/features/handoff/components/MovementsSummary.tsx](../src/features/handoff/components/MovementsSummary.tsx)
  - [src/features/handoff/components/HandoffNursingContent.tsx](../src/features/handoff/components/HandoffNursingContent.tsx)
- **Tests / checks requeridos:**
  - `src/tests/views/handoff/HandoffView.test.tsx`
  - tests específicos del componente si aplica
- **Criterio de cierre:** menos lógica incidental en render, sin tocar semántica clínica.

---

## 10. Recomendación de estrategia

- **Estrategia recomendada:** saneamiento focalizado

Justificación:

- El módulo ya está fuerte.
- La señal de tests es buena.
- No necesita reorganización grande; sí conviene una ronda corta de consolidación, sobre todo en el runtime compartido.

---

## 11. Estado deseado después de la ronda

- Runtime de enfermería un poco más separado del resto de `handoff`.
- Checklist/staff más declarativos y con menos decisiones inline.
- Resumen de movimientos y novedades más fácil de cambiar sin tocar wiring compartido.

---

## 12. Cierre de evaluación

- **¿Se recomienda abrir mejora ahora?** sí
- **Siguiente módulo sugerido después de este:** Gestión de traslados
- **Notas adicionales:** entrega de turno enfermería está en mejor estado que muchos módulos del sistema; aquí la mejora recomendada es de consolidación fina, no de rescate.
