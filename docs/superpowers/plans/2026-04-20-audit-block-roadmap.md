# Roadmap de Bloques de Auditoria

Fecha base: 2026-04-20  
Objetivo: ejecutar mejoras de alto valor derivadas de la auditoría técnica sin sobreingeniería ni reescrituras.

## Estado actual

- Bloque actual en curso: `Bloque 5: Escalabilidad Técnica y Performance`
- Siguiente bloque acordado después de este: `Bloque 6: Documentación y Operación`

## Bloques

### Bloque 1: Arquitectura Ejecutable y Estabilidad Base

Estado: `completado`

Resultado:

- se eliminaron barrels puente en `application`
- se rompieron ciclos en `census`, `cudyr` y `backup-export`
- `application` dejó de depender de `hooks/controllers`
- se encapsuló el runtime state de sync
- `check:quality`, `typecheck` y `check:bundle-budget` quedaron verdes

Validación ejecutada:

- `npm run typecheck`
- `npm run check:quality`
- `npm run check:bundle-budget`
- Vitest dirigido del bloque

### Bloque 2: Seguridad y Control de Privilegios

Estado: `completado`

Resultado:

- se retiró la allowlist hard-coded de bootstrap admin de `firestore.rules`
- se retiró la allowlist hard-coded de `storage.rules`
- `functions/lib/auth/*`, `netlify/functions/lib/firebase-auth.ts` y `src/services/auth/*` dejaron de depender de correos embebidos
- `setUserRole` quedó restringido a claim admin real
- la documentación canónica de acceso y runbooks se actualizaron al modelo sin bypass
- el harness/tests de reglas se ajustaron al modelo canónico con `config/roles`

Validación ejecutada:

- `npm run typecheck`
- `npm run check:security`
- `npm run check:quality`
- `npx vitest run src/tests/security/rulesHardeningStatic.test.ts src/tests/functions/authCallablePolicy.test.ts src/tests/functions/authHelpersFactory.test.ts src/tests/functions/authFunctionsFactory.test.ts src/tests/services/auth/authRoleLookup.test.ts src/tests/services/auth/authRoleResolutionController.test.ts src/tests/services/authService.test.ts src/tests/netlify/firebaseAuth.test.ts`
- `bash scripts/run-firestore-rules-ci.sh`

Riesgo residual aceptado:

- siguen existiendo referencias históricas al bootstrap admin en documentos de auditoría/iteración previos; se conservan como registro histórico, no como contrato vigente

### Bloque 3: Cobertura Crítica y Confianza Operativa

Estado: `completado`

Resultado:

- se corrigieron bloqueos de suite que impedían medir cobertura real en `authFlowRuntime`, `census-export` y `useExportManager`
- se añadieron tests directos para `useClinicalDocumentIndicationsCatalog`, `useClinicalDocumentSheetState` y `useClinicalDocumentDraftRemoteSync`
- `src/features/clinical-documents` pasó de quedar bajo baseline a superar el gate crítico
- `reports/critical-coverage.md` quedó en `passing`
- `reports/operational-health.md` quedó con `Critical Coverage` en `passing`

Validación ejecutada:

- `npx vitest run src/tests/services/auth/authFlowRuntime.test.ts`
- `npx vitest run src/tests/integration/census-export.test.ts`
- `npx vitest run src/tests/hooks/useExportManager.test.ts src/tests/features/clinical-documents/useClinicalDocumentIndicationsCatalog.test.ts src/tests/features/clinical-documents/useClinicalDocumentSheetState.test.ts src/tests/features/clinical-documents/useClinicalDocumentDraftRemoteSync.test.ts`
- `npm run check:critical-coverage`
- `node scripts/report-critical-coverage.mjs`
- `node scripts/report-operational-health.mjs`
- `node scripts/report-system-confidence.mjs`

Riesgo residual aceptado:

- `system-confidence` sigue `degraded` por worktree sucio durante la ejecución, no por fallas abiertas ni por cobertura crítica

### Bloque 4: Mantenibilidad de Reglas y Runtime Sensible

Estado: `completado`

Objetivo:

- modularizar y volver más auditables `firestore.rules` y runtime sensible relacionado
- reducir costo de cambio sin alterar el modelo de acceso ya endurecido

Resultado:

- `firestore.rules` y `storage.rules` quedaron divididos en fuentes editables bajo `rules/`
- se añadió generación determinista de outputs raíz mediante `scripts/build-rules-assets.mjs`
- se añadió detección de drift mediante `scripts/check-rules-generated.mjs`
- `check:security` y los tests con emulador ahora fuerzan sincronización previa de reglas generadas
- el costo de revisar cambios en reglas baja sin cambiar el contrato que Firebase y el emulador esperan

Validación ejecutada:

- `npm run typecheck`
- `npm run check:security`
- `bash scripts/run-firestore-rules-ci.sh`

Riesgo residual aceptado:

- la modularización actual es por fragmentos concatenados; mejora auditabilidad y gobernanza, pero no reduce aún complejidad semántica interna de cada helper

### Bloque 5: Escalabilidad Técnica y Performance

Estado: `pendiente`

Objetivo:

- atacar hotspots de churn y deuda de performance sin abrir refactors masivos

### Bloque 6: Documentación y Operación

Estado: `pendiente`

Objetivo:

- depurar documentación duplicada y consolidar runbooks finales después de cerrar lo estructural, de seguridad y de cobertura
