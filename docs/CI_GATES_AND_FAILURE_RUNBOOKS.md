# CI Gates and Failure Runbooks

## Objetivo

Definir una ruta corta para desarrollo diario y una ruta blocking para merge/release sin duplicar checks caros.

## Gates activos

### `ci:inner-loop`

Usar cuando el cambio todavía está en iteración local.

Incluye:

- `npm run typecheck`
- `npm run lint -- --max-warnings 0`
- `npm run check:quality`
- `npm run check:test-failure-catalog`
- `npm run test:unit:critical`

Salida esperada:

- feedback rápido sobre tipado, lint, guardrails estructurales y riesgos unitarios críticos.

### `ci:merge-gate`

Usar antes de merge o cuando una change toca código clínico, almacenamiento, auth, bundle o lazy loading.

Incluye:

- `npm run typecheck`
- `npm run lint -- --max-warnings 0`
- `npm run check:quality`
- `npm run check:test-failure-catalog`
- `npm run test:ci:unit`
- `npm run check:critical-coverage`
- `npm run build`
- `npm run check:bundle-budget`

Salida esperada:

- cobertura crítica instrumentada sin regresión;
- build productivo válido;
- budgets de bundle dentro de los límites vigentes.

### `ci:release-gate`

Usar antes de release o para validar cambios con impacto en Firestore, emuladores, reglas o E2E críticos.

Incluye:

- `npm run ci:merge-gate`
- `npm run test:firestore:release:ci`

### `test:release-confidence`

Pack versionado compacto para release confidence, definido en `scripts/config/release-confidence-pack.json`.

Debe seguir cubriendo:

- `test:smoke:critical-runtime`
- `test:rules:ci`
- `test:emulator:sync:ci`
- `check:critical-coverage`
- `check:flow-performance-budget`
- `test:e2e:critical:ci`

El script extendido `test:release-confidence:full` agrega `test:unit:critical` cuando se quiere una corrida más profunda o diagnóstica.
La trazabilidad obligatoria por área crítica vive en `scripts/config/release-confidence-matrix.json` y se valida con `npm run check:release-confidence-matrix`.
El ownership técnico por subsistema crítico vive en `scripts/config/technical-ownership-map.json` y se valida con `npm run check:technical-ownership-map`.
El scorecard ejecutivo consolidado vive en `reports/release-readiness-scorecard.md` y se regenera con `npm run report:release-readiness-scorecard`.
La política formal de upgrades, excepciones y tipos de cambio vive en `scripts/config/sustainable-change-policy.json` y se valida con `npm run check:sustainable-change-policy`.

Salida esperada:

- ruta blocking compacta y repetible para release;
- reglas, emulador sync y E2E críticos verdes en la misma corrida;
- sin duplicar en la ruta por defecto checks que ya quedan cubiertos por smoke/E2E críticos.

### Falla `check:release-confidence-matrix`

1. correr `npm run report:release-confidence-matrix`
2. revisar `reports/release-confidence-matrix.md`
3. confirmar que cada área crítica siga mapeada a:
   - una o más zonas de `critical coverage`, o evidencia equivalente de smoke/flow
   - al menos un paso blocking del release pack
4. si agregaste una zona nueva de coverage, un smoke nuevo o un flow budget nuevo, actualizar la matriz en la misma change
5. no aceptar perfiles compactos sin trazabilidad explícita de qué área protegen

### Falla `check:technical-ownership-map`

1. correr `npm run report:technical-ownership-map`
2. revisar `reports/technical-ownership-map.md`
3. confirmar que cada subsistema crítico siga teniendo:
   - `owner` técnico
   - `primaryMetric`
   - al menos un `gate`
   - al menos un `runbook`
4. si agregaste un subsistema crítico nuevo o cambió el runbook operativo, actualizar el mapa en la misma change
5. no aceptar deuda crítica sin owner operativo explícito

### Falla `check:release-readiness-scorecard`

1. correr `npm run report:release-readiness-scorecard`
2. revisar `reports/release-readiness-scorecard.md`
3. confirmar que no falten reportes fuente ni haya indicadores degradados en:
   - calidad estructural
   - system confidence
   - readiness operativa
   - release confidence
   - ownership
4. si el scorecard se degrada por un reporte base, corregir ese reporte o su fuente; no maquillar el scorecard

### Falla `check:sustainable-change-policy`

1. correr `npm run report:sustainable-change-policy`
2. revisar `reports/sustainable-change-policy.md`
3. confirmar que sigan presentes:
   - los tipos de cambio canónicos
   - las reglas mínimas para upgrades
   - los campos obligatorios para excepciones
   - la relación con `Definition of Done`
4. si agregaste un tipo de cambio nuevo o una excepción nueva, actualizar esta policy en la misma change

## Qué hacer cuando falla

### Falla `check:bundle-budget`

1. correr `npm run build`
2. revisar el warning de `scripts/check-bundle-budget.mjs` y el tamaño real en `dist/assets`
3. identificar si el crecimiento viene del entry principal, de un chunk lazy o de un vendor pesado
4. preferir:
   - cortar imports cruzados;
   - mover librerías pesadas fuera del camino inicial;
   - dividir use cases/UI por flujo
5. no subir el threshold como primera respuesta

### Falla `check:critical-coverage`

1. correr `npm run test:coverage:critical`
2. revisar [reports/critical-coverage.md](./../reports/critical-coverage.md)
3. ubicar la zona degradada en `scripts/config/critical-coverage-thresholds.json`
4. decidir si la regresión es:
   - pérdida real de cobertura/invariante;
   - archivo nuevo sin tests;
   - refactor que movió líneas entre zonas
5. primero corregir tests o mapping de zona; solo después actualizar baseline si la nueva medición quedó validada a propósito

### Falla `check:test-failure-catalog`

1. revisar `scripts/config/test-failure-catalog.json`
2. confirmar que toda falla conocida tenga `owner`, `classification`, `status`, `sla` y `reason`
3. si una entrada es `flaky`, debe existir también en `scripts/config/flaky-quarantine.json`
4. si una falla fue corregida, marcarla `fixed` o removerla junto con su cuarentena asociada
5. no aceptar fallos conocidos fuera del catálogo versionado

### Falla `test:firestore:release:ci`

1. distinguir si falla `rules`, `emulator:sync`, `emulator:ui` o `e2e:critical`
2. si falla `rules`, validar contratos de schema y paths Firestore antes de tocar tests
3. si falla `emulator:sync/ui`, revisar sync queue, repositorios, IndexedDB o adapters Firestore
4. regenerar snapshots/reportes operativos si el cambio modificó budgets o recovery policies

### Falla `test:e2e:critical`

1. validar primero que no sea un locator frágil o contrato de pantalla roto
2. preferir `data-testid`, estados visibles y señales de readiness estables
3. si el problema es rendimiento, revisar bundle por flujo antes de relajar el test
4. si el cambio es intencional, actualizar el spec con el nuevo contrato explícito

### Falla en perfil especialista

1. validar primero que el rol `doctor_specialist` siga entrando por login normal y no por un flujo alternativo
2. revisar que `CENSUS` y `MEDICAL_HANDOFF` sigan siendo los únicos módulos visibles
3. si falla handoff, confirmar que la restricción de edición por día actual no se haya roto
4. si falla clinical-documents, revisar permisos de `draft` en frontend y Firestore Rules

### Falla de login / Gestión de Roles

1. revisar primero [docs/AUTH_ACCESS_MODEL.md](./AUTH_ACCESS_MODEL.md)
2. usar [docs/RUNBOOK_AUTH_ACCESS_INCIDENTS.md](./RUNBOOK_AUTH_ACCESS_INCIDENTS.md) como guía operativa corta
3. confirmar que el correo exista en `config/roles` con un rol válido
4. confirmar que el frontend ya use resolución por callable y no lectura directa del documento
5. confirmar que functions y `firestore.rules` publicadas correspondan al mismo modelo
6. si el usuario fue removido, verificar que el login termine en `signOut` y no en shell vacío

### Falla `check:flow-performance-budget`

1. correr `npm run test:e2e:flow-performance`
2. revisar `reports/e2e/flow-performance-budget.md` y `reports/e2e/flow-performance-budget-summary.json`, especialmente `status` por flujo y `breakdown`
3. distinguir si el flujo rompe:
   - `enforcedMaxMs`: deuda blocking;
   - `targetMs`: gap conocido, todavía no blocking
4. si el flujo queda en `near-limit`, corregir preload o trabajo no crítico antes de aceptar el margen
5. si el gap principal es `censoVisibleMs` o `clinicalDocumentsVisibleMs`, revisar bootstrap local, hydration, tabla y lazy loading antes de subir el límite

## Regla práctica

- cambio local chico: `ci:inner-loop`
- cambio funcional o refactor con impacto real: `ci:merge-gate`
- cambio de release, Firebase o UX crítica: `ci:release-gate`
