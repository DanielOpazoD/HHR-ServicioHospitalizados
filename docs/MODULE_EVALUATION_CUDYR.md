# Evaluación de Módulo: CUDYR

## Metadatos del módulo

- **Módulo:** CUDYR
- **Ruta(s) principal(es):**
  - [src/features/cudyr](../src/features/cudyr)
  - [src/application/cudyr](../src/application/cudyr)
  - [src/services/cudyr](../src/services/cudyr)
- **Fecha de evaluación:** 2026-04-15
- **Evaluador:** Codex
- **Estado general:** verde

---

## 1. Nota global

- **Nota global (1 a 7):** `6.8 / 7`
- **Resumen ejecutivo breve:** módulo fuerte, bastante claro en sus reglas clínicas y con una señal de tests especialmente sólida. La elegibilidad nocturna, el acceso de edición y la exportación están mejor resueltos que el promedio del repo. Tras cerrar dos bloques de consolidación, `CudyrRow.tsx` y `CudyrView.tsx` quedaron más declarativos. Lo que le impide subir más no es deuda roja, sino la ambigüedad entre `src/features/cudyr/services` y `src/services/cudyr`, además del peso residual de la fila principal.

---

## 2. Evaluación multiparamétrica

| Dimensión                        | Nota | Comentario                                                                                        |
| -------------------------------- | ---: | ------------------------------------------------------------------------------------------------- |
| Calidad general                  |  6.8 | Módulo estable, con reglas clínicas explícitas y buena cobertura.                                 |
| Estructura                       |  6.7 | Separación razonable entre feature, controllers, servicios y façade pública.                      |
| Organización                     |  6.6 | Bastante ordenado, aunque la duplicidad `feature/services` vs `services/cudyr` suma ruido.        |
| Buenas prácticas de codificación |  6.8 | Elegibilidad y acceso viven en controllers puros y eso da mucha claridad.                         |
| Coherencia funcional             |  6.8 | El comportamiento clínico del instrumento está bien asentado y bien documentado.                  |
| Separación y límites             |  6.5 | La superficie pública es corta, pero aún conviven dos capas de servicios con nombres repetidos.   |
| Estabilidad                      |  6.8 | La batería focalizada está completamente verde y cubre UI, cálculo, export y timing clínico.      |
| Escalabilidad                    |  6.6 | Puede crecer, pero conviene vigilar que no se siga cargando `CudyrRow` con más concerns visuales. |
| Documentación                    |  6.8 | README y reglas operativas del módulo son claras y útiles.                                        |
| Tests                            |  6.9 | Cobertura muy fuerte: vista, header, integración temporal, resumen, export y utilidades.          |

---

## 3. Qué hace bien este módulo

- Tiene una guía de feature clara:
  - [src/features/cudyr/README.md](../src/features/cudyr/README.md)
- La regla nocturna crítica está explícita y testeada:
  - [src/features/cudyr/controllers/cudyrEligibilityController.ts](../src/features/cudyr/controllers/cudyrEligibilityController.ts)
- El acceso de edición está separado en una política pura:
  - [src/features/cudyr/controllers/cudyrEditAccessController.ts](../src/features/cudyr/controllers/cudyrEditAccessController.ts)
- La fachada pública del módulo es corta:
  - [src/features/cudyr/public.ts](../src/features/cudyr/public.ts)
  - [src/application/cudyr/public.ts](../src/application/cudyr/public.ts)
- La señal de pruebas es especialmente buena para el tamaño del módulo.

---

## 4. Hallazgos principales

- CUDYR está mejor resuelto en reglas clínicas que en presentación visual.
- La deuda principal no está en el dominio, sino en el shell visual de la tabla y en el peso de la fila individual.
- Los dos primeros bloques ya mejoraron parte de esa densidad: `CudyrRow.tsx` ahora consume un view-model puro y `CudyrView.tsx` ya no compone inline su shell print/resumen.
- El módulo tiene una convivencia algo ruidosa entre:
  - `src/features/cudyr/services/*`
  - `src/services/cudyr/*`
- No se ve deuda roja inmediata; se ve más bien una oportunidad de consolidación y aclaración de límites.

---

## 5. Riesgos actuales

### Riesgo técnico

- Seguir agregando lógica visual/UX dentro de `CudyrRow.tsx`.
- Mantener duplicadas o desalineadas utilidades entre `feature/services` y `services/cudyr`.

### Riesgo operativo / clínico

- Regresiones en:
  - elegibilidad nocturna
  - acceso de edición por fecha/rol
  - cálculo visible de categorías
  - exportación mensual
  - impresión compartida con handoff

---

## 6. Hotspots y archivos clave

| Archivo                                                                                                   | Rol                                  | Riesgo / observación                                                                  |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| [src/features/cudyr/components/CudyrRow.tsx](../src/features/cudyr/components/CudyrRow.tsx)               | Fila principal del instrumento       | `297` líneas; ya más declarativa, pero sigue siendo la pieza visual más densa.        |
| [src/features/cudyr/components/CudyrView.tsx](../src/features/cudyr/components/CudyrView.tsx)             | Vista principal del instrumento      | `197` líneas; mejor separada entre shell y tabla, aunque todavía mezcla web/print.    |
| [src/features/cudyr/hooks/useCudyrLogic.ts](../src/features/cudyr/hooks/useCudyrLogic.ts)                 | Runtime de la pantalla               | `102` líneas; razonable, pero sigue siendo el punto de unión entre contexto y reglas. |
| [src/features/cudyr/services/cudyrExportService.ts](../src/features/cudyr/services/cudyrExportService.ts) | Exportación del resumen              | Reexport/bridge del frente documental; sensible por UX y descarga.                    |
| [src/features/cudyr/services/cudyrSummary.ts](../src/features/cudyr/services/cudyrSummary.ts)             | Resumen diario                       | Servicio central del resultado visible; conviene mantenerlo puro y pequeño.           |
| [src/services/pdf/handoffPdfCudyrSection.ts](../src/services/pdf/handoffPdfCudyrSection.ts)               | Integración CUDYR con PDF de handoff | Sensible por compartir reglas con enfermería nocturna e impresión.                    |

---

## 7. Guardrails y checks relevantes

- `npx vitest run src/tests/views/cudyr/CudyrView.test.tsx src/tests/features/cudyr/CudyrHeader.test.tsx src/tests/features/cudyr/cudyrFeature.test.ts src/tests/features/cudyr/cudyrEligibilityController.test.ts src/tests/features/cudyr/cudyrEditAccessController.test.ts src/tests/services/calculations/cudyrSummary.test.ts src/tests/integration/cudyrScoring.test.ts src/tests/integration/cudyrTimestampFlow.test.tsx src/tests/services/exporters/cudyrExportService.test.ts src/tests/utils/cudyrScoreUtils.test.ts`
- `npm run check:quality`
- `npm run typecheck`

Resultado actual de esta evaluación:

- **Suite focalizada de CUDYR:** `10/10` archivos verdes, `113/113` tests OK
- **Bloque 1 y 2 de consolidación visual:** `60/60` + `59/59` tests focalizados verdes, `npm run typecheck` OK
- No hay hoy un boundary check dedicado del módulo equivalente al de transfers/handoff.

La evaluación partió sin cambios de código, pero luego quedó reforzada con dos bloques de consolidación visual y de shell del módulo.

---

## 8. Deuda técnica priorizada

### P1

- Bajar algo de densidad visual/operativa en:
  - `CudyrRow.tsx`
  - `CudyrView.tsx`

### P2

- Aclarar la convivencia de servicios entre:
  - `src/features/cudyr/services/*`
  - `src/services/cudyr/*`

### P3

- Mantener toda regla clínica sensible en controllers puros y no reabsorberla en el render.

---

## 9. Plan de mejoras por bloques

### Bloque 1

- **Objetivo:** bajar algo de lógica incidental de la fila CUDYR.
- **Estado:** completado
- **Cambio realizado:** `CudyrRow.tsx` ahora consume `buildCudyrRowViewModel(...)` desde `cudyrRowViewController.ts`, dejando fuera del JSX la resolución de bloqueo, scores visibles, empty state, colores y readonly.
- **Archivos tocados:**
  - [src/features/cudyr/components/CudyrRow.tsx](../src/features/cudyr/components/CudyrRow.tsx)
  - [src/features/cudyr/controllers/cudyrRowViewController.ts](../src/features/cudyr/controllers/cudyrRowViewController.ts)
- **Tests / checks ejecutados:**
  - `src/tests/features/cudyr/cudyrRowViewController.test.ts`
  - `src/tests/views/cudyr/CudyrView.test.tsx`
  - `src/tests/features/cudyr/cudyrFeature.test.ts`
- **Criterio de cierre:** cumplido; fila más declarativa y con menos branching visual inline.

### Bloque 2

- **Objetivo:** hacer más declarativo el shell de `CudyrView.tsx`.
- **Estado:** completado
- **Cambio realizado:** `CudyrView.tsx` ahora usa `buildCudyrViewShellModel(...)` para resolver fecha print, etiqueta de enfermería responsable e índice de categorización, en vez de componer esos valores inline.
- **Archivos tocados:**
  - [src/features/cudyr/components/CudyrView.tsx](../src/features/cudyr/components/CudyrView.tsx)
  - [src/features/cudyr/controllers/cudyrViewController.ts](../src/features/cudyr/controllers/cudyrViewController.ts)
- **Tests / checks ejecutados:**
  - `src/tests/features/cudyr/cudyrViewController.test.ts`
  - `src/tests/views/cudyr/CudyrView.test.tsx`
  - `src/tests/features/cudyr/CudyrHeader.test.tsx`
- **Criterio de cierre:** cumplido; menos mezcla de concerns web/print/summary en la vista principal.

### Bloque 3

- **Objetivo:** revisar la superficie de servicios duplicados.
- **Cambio esperado:** aclarar o converger exports para que no convivan dos rutas equivalentes sin necesidad.
- **Archivos probables:**
  - [src/features/cudyr/services](../src/features/cudyr/services)
  - [src/services/cudyr](../src/services/cudyr)
- **Tests / checks requeridos:**
  - `src/tests/services/calculations/cudyrSummary.test.ts`
  - `src/tests/services/exporters/cudyrExportService.test.ts`
- **Criterio de cierre:** menos ruido de ubicación y menos ambigüedad para futuros cambios.

---

## 10. Recomendación de estrategia

- **Estrategia recomendada:** saneamiento focalizado

Justificación:

- El módulo ya está fuerte.
- La señal de pruebas es excelente.
- No necesita rescate estructural; sí conviene seguir podando peso visual y aclarando límites de servicios.

---

## 11. Estado deseado después de la ronda

- Fila CUDYR más fácil de leer y tocar.
- Vista principal más declarativa.
- Menos ambigüedad entre servicios del feature y servicios compartidos.

---

## 12. Cierre de evaluación

- **¿Se recomienda abrir mejora ahora?** sí, pero con cirugía fina
- **Siguiente módulo sugerido después de este:** Visualizador de laboratorio
- **Notas adicionales:** CUDYR ya está en una zona fuerte; aquí conviene consolidar y aclarar antes de crecer más.
