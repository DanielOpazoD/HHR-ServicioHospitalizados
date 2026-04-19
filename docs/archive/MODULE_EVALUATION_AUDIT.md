# Evaluación de Módulo: Auditoría

## Metadatos del módulo

- **Módulo:** Auditoría
- **Ruta(s) principal(es):**
  - [src/features/admin/components/AuditView.tsx](../src/features/admin/components/AuditView.tsx)
  - [src/hooks/useAuditData.ts](../src/hooks/useAuditData.ts)
  - [src/hooks/useAudit.ts](../src/hooks/useAudit.ts)
  - [src/hooks/useAuditWorker.ts](../src/hooks/useAuditWorker.ts)
  - [src/services/admin/auditWorkerLogic.ts](../src/services/admin/auditWorkerLogic.ts)
  - [src/services/admin/auditService.ts](../src/services/admin/auditService.ts)
  - [src/application/audit](../src/application/audit)
- **Fecha de evaluación:** 2026-04-16
- **Evaluador:** Codex
- **Estado general:** verde

---

## 1. Nota global

- **Nota global (1 a 7):** `6.7 / 7`
- **Resumen ejecutivo breve:** módulo fuerte, bastante bien cubierto por tests y mejor organizado de lo que suele parecer en una primera lectura. Tras esta ronda, el runtime de datos y el frente de consolidación quedaron más declarativos; su principal límite ya no es tanto el shell inmediato, sino la densidad residual de los hooks centrales si el módulo sigue creciendo.

---

## 2. Evaluación multiparamétrica

| Dimensión                        | Nota | Comentario                                                                                               |
| -------------------------------- | ---: | -------------------------------------------------------------------------------------------------------- |
| Calidad general                  |  6.7 | Frente serio, con una base técnica buena y señal de tests muy por encima del promedio.                   |
| Estructura                       |  6.7 | La separación `application / hooks / services / components` está bien planteada.                         |
| Organización                     |  6.5 | Hay bastante material repartido, pero el submódulo sigue siendo navegable.                               |
| Buenas prácticas de codificación |  6.7 | Usa workers, policies, access control y use cases con buena disciplina.                                  |
| Coherencia funcional             |  6.7 | Auditoría, stats, filtros y consolidación conviven razonablemente bien.                                  |
| Separación y límites             |  6.6 | `useAuditData.ts` y la consolidación quedaron más lineales, aunque el frente central sigue siendo denso. |
| Estabilidad                      |  6.7 | La batería focalizada amplia y el flujo de integración están verdes.                                     |
| Escalabilidad                    |  6.5 | Puede crecer, pero no conviene seguir cargando más responsabilidades sobre los hooks centrales.          |
| Documentación                    |  6.4 | Hay documentación implícita en tests y contracts, pero no tanto README/guía del módulo.                  |
| Tests                            |  6.9 | Muy buena señal objetiva: hooks, services, components, runtime e integración cubiertos.                  |

---

## 3. Qué hace bien este módulo

- Tiene una muy buena cobertura focalizada en:
  - hooks
  - services
  - runtime worker
  - integración de flujo
- La capa `application` está bien acotada:
  - [fetchAuditLogsUseCase.ts](../src/application/audit/fetchAuditLogsUseCase.ts)
  - [writeAuditEventUseCase.ts](../src/application/audit/writeAuditEventUseCase.ts)
- La lógica pesada de filtrado/agrupación/stats ya vive en un runtime puro y testeable:
  - [auditWorkerLogic.ts](../src/services/admin/auditWorkerLogic.ts)
- Las políticas de acceso están aisladas y bien probadas:
  - [auditAccessPolicy.ts](../src/services/admin/auditAccessPolicy.ts)

---

## 4. Hallazgos principales

- El módulo no está “desordenado”; su principal fricción es **densidad**, no falta de estructura.
- Los hotspots más claros siguen estando en:
  - [useAuditData.ts](../src/hooks/useAuditData.ts)
  - [useAudit.ts](../src/hooks/useAudit.ts)
  - [ConsolidationManager.tsx](../src/features/admin/components/components/audit/ConsolidationManager.tsx)
- El shell de [AuditView.tsx](../src/features/admin/components/AuditView.tsx) está razonablemente limpio, y ahora además depende de una consolidación algo más declarativa.
- La consolidación/exportación sigue siendo el frente con más sensibilidad operativa, aunque ya con mejor separación de shell/view-state.

---

## 5. Riesgos actuales

### Riesgo técnico

- Seguir agregando responsabilidades nuevas a `useAuditData.ts` o `useAudit.ts`.
- Acumular más reglas de consolidación/export dentro de los componentes administrativos.

### Riesgo operativo / clínico

- Regresiones silenciosas en filtros, agrupación o stats si se toca el runtime del worker sin mantener la suite focalizada.
- Errores de acceso o exposición de paneles sensibles si cambian roles/permisos sin pasar por `auditAccessPolicy.ts`.

---

## 6. Hotspots y archivos clave

| Archivo                                                                                                                                                                 | Rol                                | Riesgo / observación                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| [src/hooks/useAuditData.ts](../src/hooks/useAuditData.ts)                                                                                                               | runtime de datos principal         | `254` líneas; sigue siendo denso, pero ya con menos composición repetida inline. |
| [src/hooks/useAudit.ts](../src/hooks/useAudit.ts)                                                                                                                       | facade/hook principal de auditoría | `260` líneas; sigue siendo uno de los puntos más densos del frente.              |
| [src/services/admin/auditWorkerLogic.ts](../src/services/admin/auditWorkerLogic.ts)                                                                                     | runtime puro del worker            | `209` líneas; fuerte y bien ubicado, pero ya es un core importante.              |
| [src/features/admin/components/components/audit/ConsolidationManager.tsx](../src/features/admin/components/components/audit/ConsolidationManager.tsx)                   | consolidación operativa            | `218` líneas; área sensible por impacto operativo, ahora con mejor shell state.  |
| [src/features/admin/components/components/audit/consolidationManagerController.ts](../src/features/admin/components/components/audit/consolidationManagerController.ts) | shell/view-state puro              | seam nuevo y útil para botones, ramas de shell y preview rows.                   |
| [src/features/admin/components/AuditView.tsx](../src/features/admin/components/AuditView.tsx)                                                                           | shell del módulo                   | `157` líneas; bastante razonable, pero dependiente de hooks densos.              |
| [src/features/admin/components/components/audit/AuditStatsDashboard.tsx](../src/features/admin/components/components/audit/AuditStatsDashboard.tsx)                     | resumen visual                     | `159` líneas; aceptable, con buena cobertura.                                    |

---

## 7. Guardrails y checks relevantes

- `npm run typecheck`
- `npm run check:quality`
- suite focalizada amplia del módulo

Resultado actual:

- **Typecheck:** OK
- **Quality:** OK
- **Tests focalizados:** `17/17` archivos verdes, `115/115` tests OK, más `4/4` archivos verdes y `25/25` tests de la ronda actual
- **Otros checks:** el módulo descansa también sobre cobertura de seguridad y reglas en otros frentes (acceso a audit logs, integración, flows)

---

## 8. Deuda técnica priorizada

### P1

- Bajar algo de coordinación incidental de `useAuditData.ts`.
- Dejar más explícita la frontera entre runtime del worker y wiring del hook.

### P2

- Hacer un poco más declarativo el frente de consolidación/exportación.

### P3

- Agregar documentación corta del módulo para que la estructura no dependa tanto de leer tests.

---

## 9. Plan de mejoras por bloques

### Bloque 1

- **Objetivo:** bajar densidad del runtime principal de datos.
- **Cambio ejecutado:** sacar composición de section-actions, params del worker, paginación y toggle de sets a `auditDataPolicyController.ts`.
- **Archivos tocados:**
  - [src/hooks/useAuditData.ts](../src/hooks/useAuditData.ts)
  - [src/hooks/controllers/auditDataPolicyController.ts](../src/hooks/controllers/auditDataPolicyController.ts)
- **Tests / checks ejecutados:**
  - [src/tests/hooks/useAuditData.test.ts](../src/tests/hooks/useAuditData.test.ts)
  - [src/tests/hooks/controllers/auditDataPolicyController.test.ts](../src/tests/hooks/controllers/auditDataPolicyController.test.ts)
  - `npm run typecheck`
- **Criterio de cierre:** logrado; el hook quedó más lineal sin introducir capas innecesarias.

### Bloque 2

- **Objetivo:** domesticar un poco el frente de consolidación.
- **Cambio ejecutado:** sacar estado de acciones, ramas de shell y preview rows de `ConsolidationManager.tsx` a `consolidationManagerController.ts`.
- **Archivos tocados:**
  - [src/features/admin/components/components/audit/ConsolidationManager.tsx](../src/features/admin/components/components/audit/ConsolidationManager.tsx)
  - [src/features/admin/components/components/audit/consolidationManagerController.ts](../src/features/admin/components/components/audit/consolidationManagerController.ts)
- **Tests / checks ejecutados:**
  - [src/tests/views/admin/components/audit/ConsolidationManager.test.tsx](../src/tests/views/admin/components/audit/ConsolidationManager.test.tsx)
  - [src/tests/views/admin/components/audit/consolidationManagerController.test.ts](../src/tests/views/admin/components/audit/consolidationManagerController.test.ts)
  - `npm run typecheck`
- **Criterio de cierre:** logrado; menos lógica operativa visible en el componente.

### Bloque 3

- **Objetivo:** dejar una guía corta del módulo.
- **Cambio esperado:** README mínimo para explicar:
  - flujo fetch/filter/group/stats
  - worker runtime
  - paneles sensibles y access policy
- **Archivos probables:**
  - `src/features/admin/components/components/audit/README.md` o `src/features/admin/README.md`
- **Tests / checks requeridos:**
  - `npm run check:quality`
- **Criterio de cierre:** menor dependencia de conocimiento implícito.

---

## 10. Recomendación de estrategia

- **Estrategia recomendada:** saneamiento focalizado

Justificación:

- El módulo está fuerte y no necesita rescate grande.
- Sí tiene un retorno claro en 1-2 cortes pequeños sobre hooks densos y consolidación.
- La cobertura de tests permite tocarlo con confianza si mantenemos cirugía fina.

---

## 11. Estado deseado después de la ronda

- Hooks de auditoría un poco más lineales.
- Frente de consolidación más declarativo.
- Documentación corta que explique el mapa del módulo.

---

## 12. Cierre de evaluación

- **¿Se recomienda abrir mejora ahora?** sí, con bloques pequeños
- **Siguiente módulo sugerido después de este:** Correo de censo o Autenticación y sesión
- **Notas adicionales:** Auditoría ya tiene una base muy buena; el riesgo aquí no es falta de calidad, sino dejar crecer demasiado la coordinación central de hooks y paneles sensibles.
