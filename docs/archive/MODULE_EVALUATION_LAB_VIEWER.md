# Evaluación de Módulo: Visualizador de Laboratorio

## Metadatos del módulo

- **Módulo:** Visualizador de exámenes de laboratorio
- **Ruta(s) principal(es):**
  - [src/features/laboratory](../src/features/laboratory)
  - [src/services/laboratory](../src/services/laboratory)
- **Fecha de evaluación:** 2026-04-15
- **Evaluador:** Codex
- **Estado general:** verde

---

## 1. Nota global

- **Nota global (1 a 7):** `6.8 / 7`
- **Resumen ejecutivo breve:** módulo fuerte, bien modularizado y con una de las mejores señales de tests del sistema. El visor está bastante domesticado: `useLabViewer` concentra estado y orquestación, mientras la mayor parte de la transformación clínica vive en controllers puros. Tras cerrar los dos primeros bloques, la mecánica de selección de exámenes quedó mejor convergida dentro de `labViewerController.ts` y `LabResultsViewerModal.tsx` perdió parte del shell condicional. Lo que le impide subir más no es deuda roja, sino el peso del hook runtime principal, la complejidad natural del analysis shell y la sensibilidad del puente externo con Syslab/PDF/microbiología.

---

## 2. Evaluación multiparamétrica

| Dimensión                        | Nota | Comentario                                                                                                 |
| -------------------------------- | ---: | ---------------------------------------------------------------------------------------------------------- |
| Calidad general                  |  6.8 | Módulo serio, usable y con muy buena disciplina técnica.                                                   |
| Estructura                       |  6.8 | Separación clara entre hook runtime, controllers puros, servicios y componentes.                           |
| Organización                     |  6.7 | README útil, carpetas coherentes y bastante legibilidad general.                                           |
| Buenas prácticas de codificación |  6.8 | Mucha lógica clínica y de presentación derivada ya salió del render y vive en controllers pequeños.        |
| Coherencia funcional             |  6.8 | Búsqueda, selección, análisis, PDF y microbiología se entienden como un flujo único relativamente claro.   |
| Separación y límites             |  6.8 | Buena dentro del feature, aunque `useLabViewer` todavía es un punto de unión bastante central.             |
| Estabilidad                      |  6.8 | La señal de tests es especialmente fuerte y cubre UI, analytics, export, microbiología y el bridge Syslab. |
| Escalabilidad                    |  6.5 | Puede crecer, pero conviene vigilar que el hook runtime no siga acumulando responsabilidades.              |
| Documentación                    |  6.8 | README del módulo y contratos clínicos bastante claros.                                                    |
| Tests                            |  6.9 | Cobertura muy sólida y variada para un módulo de este tipo.                                                |

---

## 3. Qué hace bien este módulo

- Tiene una guía del módulo especialmente clara:
  - [src/features/laboratory/README.md](../src/features/laboratory/README.md)
- La lógica clínica de análisis está bastante bien separada:
  - [labAnalyticsController.ts](../src/features/laboratory/controllers/labAnalyticsController.ts)
  - [labMicrobiologyAnalyticsController.ts](../src/features/laboratory/controllers/labMicrobiologyAnalyticsController.ts)
  - [labSummaryController.ts](../src/features/laboratory/controllers/labSummaryController.ts)
  - [labComparisonController.ts](../src/features/laboratory/controllers/labComparisonController.ts)
- El visor modal está bastante declarativo para la cantidad de estados que maneja:
  - [LabResultsViewerModal.tsx](../src/features/laboratory/components/LabResultsViewerModal.tsx)
- El soporte de microbiología y fallback PDF está explícito y testeado.

---

## 4. Hallazgos principales

- El módulo está mejor resuelto en arquitectura y tests que en simplicidad del runtime.
- El principal hotspot real hoy es [useLabViewer.ts](../src/features/laboratory/hooks/useLabViewer.ts), que sigue concentrando:
  - query/cache
  - search/reset
  - selección de exámenes
  - análisis
  - bridge con PDF
  - enriquecimiento manual de paciente
- El Bloque 1 ya mejoró la parte de selección: toggle, seleccionar todo y selección por rango/días ahora convergen en `labViewerController.ts`.
- El Bloque 2 ya mejoró el shell del modal: tamaño, vistas activas y estados vacíos/lista/análisis/PDF ahora se resuelven desde un model puro en `labViewerController.ts`.
- La parte de controllers puros ya está bastante bien encaminada.
- No se ve deuda roja inmediata; se ve una necesidad de seguir reduciendo costo cognitivo en el hook principal y quizá en el shell del modal.

---

## 5. Riesgos actuales

### Riesgo técnico

- Seguir cargando `useLabViewer.ts` con nuevas reglas de interacción o nuevos side effects.
- Volver a mezclar lógica clínica de análisis dentro de componentes UI del visor.

### Riesgo operativo / clínico

- Regresiones en:
  - búsqueda Syslab
  - selección/rango de exámenes
  - análisis microbiológico
  - fallback PDF
  - exportación comparativa

---

## 6. Hotspots y archivos clave

| Archivo                                                                                                                                                   | Rol                            | Riesgo / observación                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| [src/features/laboratory/hooks/useLabViewer.ts](../src/features/laboratory/hooks/useLabViewer.ts)                                                         | Runtime principal del visor    | `367` líneas; es el punto de mayor densidad y acopla búsqueda, query, selección y análisis. |
| [src/features/laboratory/controllers/labMicrobiologyAnalyticsController.ts](../src/features/laboratory/controllers/labMicrobiologyAnalyticsController.ts) | Analítica microbiológica       | `224` líneas; lógica especializada y sensible por parsing/fallback.                         |
| [src/services/laboratory/syslabService.ts](../src/services/laboratory/syslabService.ts)                                                                   | Integración externa con Syslab | `158` líneas; bridge sensible por red, scraping y errores operativos.                       |
| [src/features/laboratory/components/LabResultsViewerModal.tsx](../src/features/laboratory/components/LabResultsViewerModal.tsx)                           | Shell del visor                | `131` líneas; razonable, pero es el borde más visible de la experiencia del módulo.         |
| [src/features/laboratory/components/LabViewerAnalysis.tsx](../src/features/laboratory/components/LabViewerAnalysis.tsx)                                   | Análisis renderizado           | `134` líneas; combina tabs, navegación y composición de análisis.                           |

---

## 7. Guardrails y checks relevantes

- `npx vitest run src/tests/hooks/laboratory/useLabViewer.test.ts src/tests/hooks/laboratory/labViewerController.test.ts src/tests/features/laboratory/labAnalyticsController.test.ts src/tests/features/laboratory/labAnalysisResultController.test.ts src/tests/features/laboratory/labFindingCollectionController.test.ts src/tests/features/laboratory/labFormattingController.test.ts src/tests/features/laboratory/labSummaryController.test.ts src/tests/features/laboratory/labMicrobiologyAnalyticsController.test.ts src/tests/components/laboratory/LabViewerComponents.test.tsx src/tests/components/laboratory/LabResultsViewerModal.test.tsx src/tests/components/laboratory/LabViewerComparisonTable.test.tsx src/tests/features/laboratory/labExcelService.test.ts src/tests/features/laboratory/labMicrobiologyPdfService.test.ts src/tests/features/laboratory/labConstants.test.ts src/tests/services/laboratory/syslabService.test.ts`
- `npm run check:quality`
- `npm run typecheck`

Resultado actual de esta evaluación:

- **Suite focalizada del visualizador de laboratorio:** `15/15` archivos verdes, `163/163` tests OK
- **Bloque 1 runtime de selección:** `70/70` tests focalizados verdes entre hook/controller/modal/shell, `npm run typecheck` OK
- **Bloque 2 shell del visor:** `71/71` tests focalizados verdes entre controller/hook/modal/shell, `npm run typecheck` OK
- No hay hoy un boundary check dedicado del módulo equivalente al de transfers/handoff.

La evaluación partió sin cambios de código, pero luego quedó reforzada con dos bloques de consolidación del runtime y del shell del visor.

---

## 8. Deuda técnica priorizada

### P1

- Seguir reduciendo coordinación incidental en:
  - `useLabViewer.ts`
  - `LabResultsViewerModal.tsx`

### P2

- Vigilar y quizá compactar algo de complejidad en:
  - `labMicrobiologyAnalyticsController.ts`
  - `syslabService.ts`

### P3

- Mantener toda regla clínica/derivada dentro de controllers puros y no reabsorberla en la UI del visor.

---

## 9. Plan de mejoras por bloques

### Bloque 1

- **Objetivo:** bajar algo de coordinación del runtime principal.
- **Estado:** completado
- **Cambio realizado:** `useLabViewer.ts` ahora delega la mecánica de toggle, seleccionar todo y selección por rango/días a `labViewerController.ts`, evitando más manipulación inline de `Set` dentro del hook.
- **Archivos tocados:**
  - [src/features/laboratory/hooks/useLabViewer.ts](../src/features/laboratory/hooks/useLabViewer.ts)
  - [src/features/laboratory/controllers/labViewerController.ts](../src/features/laboratory/controllers/labViewerController.ts)
- **Tests / checks ejecutados:**
  - `src/tests/hooks/laboratory/useLabViewer.test.ts`
  - `src/tests/hooks/laboratory/labViewerController.test.ts`
- **Criterio de cierre:** cumplido; menos handlers/estado incidental manual dentro del hook principal.

### Bloque 2

- **Objetivo:** hacer más declarativo el shell del visor.
- **Estado:** completado
- **Cambio realizado:** `LabResultsViewerModal.tsx` ahora usa `buildLabViewerModalShellModel(...)` desde `labViewerController.ts` para resolver tamaño de modal y qué subvista mostrar (`controls`, `pdf`, `analysis`, `list`, `empty`), quitando branching incidental del shell.
- **Archivos tocados:**
  - [src/features/laboratory/components/LabResultsViewerModal.tsx](../src/features/laboratory/components/LabResultsViewerModal.tsx)
  - [src/features/laboratory/controllers/labViewerController.ts](../src/features/laboratory/controllers/labViewerController.ts)
- **Tests / checks ejecutados:**
  - `src/tests/components/laboratory/LabResultsViewerModal.test.tsx`
  - `src/tests/components/laboratory/LabViewerComponents.test.tsx`
- `src/tests/hooks/laboratory/labViewerController.test.ts`
- `src/tests/hooks/laboratory/useLabViewer.test.ts`
- **Criterio de cierre:** cumplido; más lectura declarativa del visor y menos branching incidental en el shell.

### Bloque 3

- **Objetivo:** consolidar el frente externo/microbiología.
- **Cambio esperado:** extraer una política pura o converger una pequeña rama de error/fallback en `syslabService.ts` o `labMicrobiologyAnalyticsController.ts`.
- **Archivos probables:**
  - [src/services/laboratory/syslabService.ts](../src/services/laboratory/syslabService.ts)
  - [src/features/laboratory/controllers/labMicrobiologyAnalyticsController.ts](../src/features/laboratory/controllers/labMicrobiologyAnalyticsController.ts)
- **Tests / checks requeridos:**
  - `src/tests/services/laboratory/syslabService.test.ts`
  - `src/tests/features/laboratory/labMicrobiologyAnalyticsController.test.ts`
- **Criterio de cierre:** menos branching incidental sin tocar el contrato externo del visor.

---

## 10. Recomendación de estrategia

- **Estrategia recomendada:** saneamiento focalizado

Justificación:

- El módulo ya está fuerte.
- Tiene una señal de pruebas excelente.
- No necesita rescate estructural; sí conviene seguir bajando densidad del runtime principal y del shell visual.

---

## 11. Estado deseado después de la ronda

- Hook principal más lineal.
- Visor modal más declarativo.
- Menor costo cognitivo para tocar búsqueda, análisis y selección sin romper el módulo.

---

## 12. Cierre de evaluación

- **¿Se recomienda abrir mejora ahora?** sí
- **Siguiente módulo sugerido después de este:** Solicitud de exámenes de laboratorio
- **Notas adicionales:** este módulo ya está en una zona muy buena; las mejoras aquí son de consolidación y legibilidad, no de rescate.
