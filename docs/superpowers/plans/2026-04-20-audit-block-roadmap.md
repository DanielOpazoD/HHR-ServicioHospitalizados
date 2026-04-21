# Roadmap de Bloques de Auditoria

Fecha base: 2026-04-20  
Objetivo: ejecutar mejoras de alto valor derivadas de la auditoría técnica sin sobreingeniería ni reescrituras.

## Estado actual

- Bloque actual cerrado: `Bloque 2: Seguridad y Control de Privilegios`
- Siguiente bloque acordado: `Bloque 3: Cobertura Crítica y Confianza Operativa`

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

Estado: `pendiente`

Objetivo:

- cerrar el gap de cobertura crítica, empezando por `src/features/clinical-documents`
- reforzar ramas de permisos, error, persistencia y exportación
- dejar de depender de un `system-confidence` degradado por cobertura insuficiente

Entrada mínima para comenzar:

- mantener verdes `typecheck`, `check:quality`, `check:security` y `test:rules:ci`
- usar el baseline actual de `reports/critical-coverage.md` como referencia de cierre

### Bloque 4: Mantenibilidad de Reglas y Runtime Sensible

Estado: `pendiente`

Objetivo:

- modularizar y volver más auditables `firestore.rules` y runtime sensible relacionado
- reducir costo de cambio sin alterar el modelo de acceso ya endurecido

### Bloque 5: Escalabilidad Técnica y Performance

Estado: `pendiente`

Objetivo:

- atacar hotspots de churn y deuda de performance sin abrir refactors masivos

### Bloque 6: Documentación y Operación

Estado: `pendiente`

Objetivo:

- depurar documentación duplicada y consolidar runbooks finales después de cerrar lo estructural, de seguridad y de cobertura
