# Evaluación de Módulo: Entrega de Turno Médico

## Metadatos del módulo

- **Módulo:** Entrega de turno médico
- **Ruta(s) principal(es):**
  - [src/features/handoff](../src/features/handoff)
  - [src/application/handoff](../src/application/handoff)
  - [src/domain/handoff](../src/domain/handoff)
- **Fecha de evaluación:** 2026-04-15
- **Evaluador:** Codex
- **Estado general:** verde

---

## 1. Nota global

- **Nota global (1 a 7):** `6.7 / 7`
- **Resumen ejecutivo breve:** submódulo fuerte, bien gobernado y con muy buena cobertura real. Su arquitectura interna está bastante madura y el frente médico especializado está mejor resuelto que el promedio del repo. Tras la ronda actual, el shell de pantalla y la sección médica por especialidad quedaron un poco más declarativos; lo que le impide subir más ya no es deuda roja, sino el costo cognitivo residual del workspace compartido con enfermería y algunas piezas grandes todavía densas.

---

## 2. Evaluación multiparamétrica

| Dimensión                        | Nota | Comentario                                                                                                |
| -------------------------------- | ---: | --------------------------------------------------------------------------------------------------------- |
| Calidad general                  |  6.7 | Muy buen nivel para un frente clínico sensible y con varias rutas de edición/continuidad.                 |
| Estructura                       |  6.7 | Buena separación entre `feature`, `application` y `domain`, con surfaces documentadas de forma explícita. |
| Organización                     |  6.6 | El módulo está bien organizado, aunque comparte bastante superficie con handoff de enfermería.            |
| Buenas prácticas de codificación |  6.8 | Hay buen uso de controllers, use cases y outcomes homogéneos.                                             |
| Coherencia funcional             |  6.6 | La lógica de continuidad, especialidades y vigencia diaria está bien aterrizada.                          |
| Separación y límites             |  6.7 | Muy buena disciplina de boundaries y entrypoints.                                                         |
| Estabilidad                      |  6.6 | La batería focalizada está completamente verde y bastante profunda.                                       |
| Escalabilidad                    |  6.5 | Puede crecer, pero conviene mantener separados los concerns médico, enfermería y CUDYR/print.             |
| Documentación                    |  6.8 | El frente está especialmente bien documentado para rutas críticas y cambios seguros.                      |
| Tests                            |  6.8 | Cobertura fuerte y bien distribuida entre `application`, `domain`, `views`, `hooks` e integración.        |

---

## 3. Qué hace bien este módulo

- Tiene una guía de cambio segura muy buena:
  - [src/features/handoff/README.md](../src/features/handoff/README.md)
  - [docs/ADR_HANDOFF_RUNTIME_SURFACES.md](./ADR_HANDOFF_RUNTIME_SURFACES.md)
  - [docs/HANDOFF_SPECIALIST_MEDICAL_WRITE_PATH.md](./HANDOFF_SPECIALIST_MEDICAL_WRITE_PATH.md)
- La ruta médica por especialidad está bien formalizada tanto en UI como en application/domain.
- El frente especialista ya no depende de un write directo frágil; la ruta productiva está explicitada y documentada.
- La lógica de negocio más delicada vive en `application/handoff` y `domain/handoff`, no enterrada en JSX.
- La cobertura de tests es muy buena y diversa.
- El screen model y la sección médica por especialidad ya delegan parte de su ensamblaje a view-models/controladores más explícitos, con menos decisión incidental inline.
- La resolución inicial de filtros médicos por URL y el armado completo de tabs por especialidad también quedaron convergidos en controllers, en vez de dispersos entre hook y JSX.

---

## 4. Hallazgos principales

- El submódulo médico está bastante bien domesticado comparado con otros frentes del repo.
- El principal costo cognitivo viene de compartir espacio visual y runtime con handoff de enfermería, impresión, eventos clínicos y CUDYR.
- Hay varios archivos todavía densos, pero ya no se ven desordenados; más bien concentran coordinación real del dominio.
- La documentación y los checks del frente handoff son mejores que el promedio del programa.
- La ronda actual dejó mejor encapsulados el shell de pantalla médica (`buildHandoffScreenShellModel`) y el estado activo de la sección por especialidad (`buildMedicalSpecialtySectionViewModel`).
- La segunda tanda dejó menos composición repetida tanto en los filtros iniciales del screen model como en el listado de tabs visibles por especialidad.

---

## 5. Riesgos actuales

### Riesgo técnico

- Reintroducir lógica médica o de continuidad diaria en componentes del feature en vez de mantenerla en `application/handoff` o `domain/handoff`.
- Mezclar más concerns del handoff médico con enfermería/CUDYR/print en el mismo componente o hook.

### Riesgo operativo / clínico

- Regresiones en:
  - continuidad diaria por especialidad
  - restricciones por fecha del especialista
  - visibilidad/edición por scope médico
  - integraciones de impresión y CUDYR nocturno

---

## 6. Hotspots y archivos clave

| Archivo                                                                                                                                           | Rol                               | Riesgo / observación                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| [src/application/handoff/medicalPatientHandoffUseCases.ts](../src/application/handoff/medicalPatientHandoffUseCases.ts)                           | Use cases médicos por paciente    | `358` líneas; fuerte, pero ya bastante bien separado.                                  |
| [src/domain/handoff/management.ts](../src/domain/handoff/management.ts)                                                                           | Reglas de management general      | `331` líneas; alto valor del dominio compartido.                                       |
| [src/features/handoff/components/MedicalSpecialtyHandoffSection.tsx](../src/features/handoff/components/MedicalSpecialtyHandoffSection.tsx)       | UI principal del handoff médico   | Ya delega mejor su estado activo, pero sigue siendo un foco natural de complejidad.    |
| [src/features/handoff/controllers/handoffRowCellsController.ts](../src/features/handoff/controllers/handoffRowCellsController.ts)                 | View-model de celdas de fila      | `293` líneas; sensible por mezclar reglas visuales y de capabilities.                  |
| [src/features/handoff/hooks/useHandoffViewScreenModel.ts](../src/features/handoff/hooks/useHandoffViewScreenModel.ts)                             | Composition root del feature      | Mejoró al converger frame/audit/capabilities, pero sigue concentrando bastante wiring. |
| [src/features/handoff/controllers/medicalSpecialtyHandoffController.ts](../src/features/handoff/controllers/medicalSpecialtyHandoffController.ts) | Reglas de tabs/continuidad médica | `267` líneas; pieza central del submódulo médico.                                      |

---

## 7. Guardrails y checks relevantes

- `npx vitest run src/tests/application/handoff src/tests/domain/handoff src/tests/views/handoff src/tests/hooks/useHandoffManagement.test.ts src/tests/hooks/useHandoffManagementPersistence.test.ts src/tests/hooks/useHandoffLogic.medical-handoff.test.ts src/tests/integration/handoff-signature.test.ts`
- `npm run check:handoff-context-boundaries`
- `npm run check:quality`
- `npm run typecheck`

Resultado actual de esta evaluación:

- **Suite focalizada de handoff:** `38/38` archivos verdes, `187/187` tests OK
- **Handoff context boundaries:** verde
- **Ronda de saneamiento shell/especialidad:** `4/4` archivos verdes, `26/26` tests OK
- **Ronda adicional de tabs/filtros iniciales:** `3/3` archivos verdes, `20/20` tests OK
- **Typecheck después de la ronda:** verde

En la ronda actual sí hubo cambios de código focalizados, y el frente mantuvo `check:handoff-context-boundaries` y `typecheck` en verde.

---

## 8. Deuda técnica priorizada

### P1

- Mantener separado el dominio médico del resto del shell handoff.
- Seguir evitando que `useHandoffViewScreenModel` vuelva a mezclar demasiada coordinación incidental.

### P2

- Reducir densidad en:
  - `MedicalSpecialtyHandoffSection.tsx`
  - `medicalSpecialtyHandoffController.ts`
  - `handoffRowCellsController.ts`

### P3

- Seguir aclarando límites con CUDYR, impresión y share actions cuando el cambio sea médico-específico.

---

## 9. Plan de mejoras por bloques

### Bloque 1

- **Objetivo:** bajar densidad del shell de pantalla médica.
- **Cambio esperado:** extraer más policies pequeñas desde `useHandoffViewScreenModel.ts` a controllers o read models puros.
- **Estado actual:** parcialmente completado con `buildHandoffScreenShellModel(...)`.
- **Avance adicional:** la resolución inicial de `scope` y `specialty` también quedó convergida en `resolveInitialMedicalFiltersFromLocation(...)`.
- **Archivos probables:**
  - [src/features/handoff/hooks/useHandoffViewScreenModel.ts](../src/features/handoff/hooks/useHandoffViewScreenModel.ts)
  - [src/features/handoff/controllers/handoffViewController.ts](../src/features/handoff/controllers/handoffViewController.ts)
  - [src/features/handoff/controllers/handoffViewBindingsController.ts](../src/features/handoff/controllers/handoffViewBindingsController.ts)
- **Criterio de cierre:** menos coordinación incidental de auditoría, título, scope y actions en el hook principal.

### Bloque 2

- **Objetivo:** seguir domesticando el workspace de especialidades.
- **Cambio esperado:** sacar 1-2 decisiones operativas más de `MedicalSpecialtyHandoffSection.tsx`.
- **Estado actual:** parcialmente completado con `buildMedicalSpecialtySectionViewModel(...)`.
- **Avance adicional:** el listado completo de tabs ahora se arma con `buildMedicalSpecialtyTabsState(...)`.
- **Archivos probables:**
  - [src/features/handoff/components/MedicalSpecialtyHandoffSection.tsx](../src/features/handoff/components/MedicalSpecialtyHandoffSection.tsx)
  - [src/features/handoff/controllers/medicalSpecialtyHandoffController.ts](../src/features/handoff/controllers/medicalSpecialtyHandoffController.ts)
- **Criterio de cierre:** menos branching visual y más view-model explícito para tabs, continuidad y actor.

### Bloque 3

- **Objetivo:** aislar todavía mejor las reglas visuales de fila médica.
- **Cambio esperado:** mover más gating/view-state de celdas médicas a controllers pequeños.
- **Archivos probables:**
  - [src/features/handoff/components/HandoffRow.tsx](../src/features/handoff/components/HandoffRow.tsx)
  - [src/features/handoff/components/HandoffRowCells.tsx](../src/features/handoff/components/HandoffRowCells.tsx)
  - [src/features/handoff/controllers/handoffRowCellsController.ts](../src/features/handoff/controllers/handoffRowCellsController.ts)
- **Criterio de cierre:** menor acoplamiento entre render de fila y reglas médicas/observacionales.

---

## 10. Recomendación de estrategia

- **Estrategia recomendada:** saneamiento focalizado con prioridad media-alta

Justificación:

- El frente ya está fuerte.
- La cobertura actual permite mejorar con confianza.
- No necesita re-arquitectura; necesita seguir bajando densidad local y evitar mezclar más concerns.

---

## 11. Estado deseado después de la ronda

- Hook de pantalla más liviano.
- Workspace médico por especialidad más declarativo.
- Menos complejidad incidental en fila/celdas.
- El submódulo sigue fuerte, pero con mejor costo de cambio.

---

## 12. Cierre de evaluación

- **¿Se recomienda abrir mejora ahora?** sí
- **Siguiente módulo sugerido después de este:** Entrega de turno enfermería
- **Notas adicionales:** entrega de turno médico está en mejor forma que varios módulos del repo. La mejora aquí es de consolidación y legibilidad, no de rescate estructural.
