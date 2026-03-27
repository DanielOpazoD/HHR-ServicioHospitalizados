# HHR (Hospital Handoff Record)

Aplicación web médica para censo hospitalario, entrega de turno y gestión operativa clínica.

Modelo de acceso:

- [Auth Access Model](docs/AUTH_ACCESS_MODEL.md)
- [Runbook Auth Access Incidents](docs/RUNBOOK_AUTH_ACCESS_INCIDENTS.md)

## Quick Start

### Requisitos

- Node.js 22.x
- npm 10+
- Firebase project (variables de entorno en `.env`)

### Política de versiones de Node

- El workspace principal (`package.json`) usa Node.js `22.x` para desarrollo local, tests, lint, typecheck y build.
- `functions/package.json` mantiene runtime Node.js `20` porque ese sigue siendo el target actual de Firebase Functions para este proyecto.
- Si se cambia alguno de esos targets, esta sección debe actualizarse junto con ambos `package.json`.

### Instalación

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

Por defecto Vite inicia en `http://localhost:3000`.

Si necesitas `3005`:

```bash
npm run dev -- --port 3005
```

### Variables de entorno

- `VITE_FIREBASE_*`: configuración cliente de Firebase para desarrollo local.
- `VITE_FIREBASE_API_KEY_B64`: alternativa opcional a la API key plana.
- `VITE_FUNCTIONS_EMULATOR_HOST`, `VITE_AUTH_EMULATOR_HOST`, `VITE_FIRESTORE_EMULATOR_HOST`: solo para emuladores locales.
- `VITE_LOCAL_GEMINI_API_KEY`: solo fallback local de CIE-10 en `localhost`.
- `GEMINI_API_KEY`, `API_KEY`, `GMAIL_*`: uso server-side en Netlify Functions, nunca como `VITE_*`.
- `VITE_ALLOW_DEV_EMAIL_SEND`: habilita pruebas reales de email solo en desarrollo local.

### Build y preview

```bash
npm run build
npm run preview
```

## Tech Stack

| Capa                  | Tecnología                          | Uso                                          |
| --------------------- | ----------------------------------- | -------------------------------------------- |
| Frontend              | React 19 + TypeScript               | UI tipada y composición por hooks            |
| Bundler               | Vite 6                              | Dev server, build, alias `@`                 |
| Estilos               | Tailwind CSS 4 + CSS variables      | Design system clínico y temas                |
| Estado servidor/cache | TanStack Query                      | Cache, invalidación, sincronización reactiva |
| Estado app            | Context API + hooks especializados  | Estado global, auth, UI y censo              |
| Persistencia local    | IndexedDB (Dexie) + localStorage    | Offline-first + fallback                     |
| Persistencia remota   | Firebase Firestore + Auth + Storage | Datos clínicos, autenticación, backup        |
| Validación            | Zod + validaciones de dominio       | Integridad de entrada y contratos            |
| Testing               | Vitest + RTL + Playwright           | Unit, integración y e2e                      |

## Perfil Especialista

El rol `doctor_specialist` entra por el login habitual de Google y usa una policy transversal, sin modos de acceso alternativos.

Alcance actual:

- módulos visibles: `CENSUS` y `MEDICAL_HANDOFF`
- censo: vista abreviada, sin edición de datos censales
- documentos clínicos: lectura y edición de borradores
- entrega médica: edición clínica restringida por día actual

Restricciones clave:

- no firma entrega médica
- no envía por WhatsApp
- no usa funciones administrativas
- no edita entregas médicas de días previos

Los accesos directos al handoff médico ya no usan un “modo especialista” separado; son deep-links normales al módulo `MEDICAL_HANDOFF`.

## Comandos Principales

| Comando                                      | Objetivo                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`                                | Levantar app en modo desarrollo                                                                  |
| `npm run build`                              | Build de producción                                                                              |
| `npm run preview`                            | Preview local del build                                                                          |
| `npm run typecheck`                          | Verificación TypeScript                                                                          |
| `npm run test`                               | Suite Vitest completa                                                                            |
| `npm run test:watch`                         | Vitest en watch mode                                                                             |
| `npm run test:coverage`                      | Cobertura de tests                                                                               |
| `npm run test:e2e`                           | End-to-end (Playwright)                                                                          |
| `npm run test:e2e:critical`                  | E2E crítico emulador (Chromium por defecto; multi-browser por `E2E_CRITICAL_BROWSERS`)           |
| `npm run lint`                               | Lint global con tolerancia cero a warnings                                                       |
| `npm run check:quality`                      | Checks de arquitectura, tamaño de módulo y boundaries runtime                                    |
| `npm run check:test-failure-catalog`         | Valida el catálogo versionado de fallos conocidos y cuarentenas                                  |
| `npm run ci:inner-loop`                      | Gate corto para desarrollo diario (`typecheck`, lint estricto, quality y riesgo unitario)        |
| `npm run ci:merge-gate`                      | Gate blocking previo a merge (`quality`, unitarios completos, cobertura crítica, build, bundle)  |
| `npm run ci:release-gate`                    | Gate final de release (`merge-gate` + Firestore rules/emulador/E2E crítico)                      |
| `npm run test:rules`                         | Tests de reglas Firestore                                                                        |
| `npm run test:risk:admin-health`             | Riesgo operativo de health dashboard y contratos                                                 |
| `npm run report:quality-metrics`             | Snapshot de métricas de calidad para artefactos CI                                               |
| `npm run report:operational-health`          | Snapshot operativo de budgets, sync y runbooks                                                   |
| `npm run report:system-confidence`           | Scorecard mínimo de confianza del sistema con 5 indicadores                                      |
| `npm run report:release-readiness-scorecard` | Scorecard ejecutivo unificado para calidad, operación y readiness de release                     |
| `npm run report:sustainable-change-policy`   | Política versionada para tipos de cambio, upgrades y excepciones                                 |
| `npm run report:runtime-contracts`           | Snapshot de contratos runtime y evolución de esquema                                             |
| `npm run report:critical-coverage`           | Reporte gated de cobertura crítica por zona                                                      |
| `npm run check:critical-coverage`            | Gate de cobertura crítica instrumentada por zona                                                 |
| `npm run test:e2e:flow-performance`          | Medición E2E de performance por flujo (`login`, `auth`, `censo`, `clinical-documents`, `backup`) |
| `npm run check:flow-performance-budget`      | Gate y reporte de budgets operativos por flujo                                                   |

## Estructura del Proyecto

### Raíz

| Path               | Propósito                                      |
| ------------------ | ---------------------------------------------- |
| `src/`             | Código fuente principal                        |
| `docs/`            | Documentación técnica y operativa              |
| `scripts/`         | Scripts de calidad/arquitectura y utilidades   |
| `e2e/`             | Tests end-to-end y visuales                    |
| `public/`          | Assets estáticos públicos                      |
| `functions/`       | Firebase Functions                             |
| `firestore.rules`  | Reglas de seguridad de Firestore               |
| `vite.config.ts`   | Configuración Vite y plugins                   |
| `vitest.config.ts` | Configuración de pruebas unitarias/integración |

### Capas en `src/`

| Capa/Directorio   | Rol                                                                               |
| ----------------- | --------------------------------------------------------------------------------- |
| `src/features/`   | Módulos de negocio por feature (census, handoff, transfers, etc.)                 |
| `src/components/` | Componentes UI reutilizables y layout global                                      |
| `src/hooks/`      | Hooks de orquestación y lógica de aplicación                                      |
| `src/context/`    | Context providers y contratos de estado global                                    |
| `src/services/`   | Acceso a datos, repositorios, integración externa y utilidades de infraestructura |
| `src/domain/`     | Lógica de dominio transversal                                                     |
| `src/shared/`     | Runtime adapters y tipos transversales de UI                                      |
| `src/types/`      | Contratos TypeScript de entidades y DTOs                                          |
| `src/schemas/`    | Esquemas de validación                                                            |
| `src/utils/`      | Helpers puros transversales                                                       |
| `src/tests/`      | Pruebas por capa y por feature                                                    |

## Path Aliases

Definidos en `tsconfig.json` y `vite.config.ts`:

| Alias | Resuelve a |
| ----- | ---------- |
| `@/`  | `src/`     |

Ejemplo:

```ts
import { useDailyRecord } from '@/hooks/useDailyRecord';
```

## Índice de Documentación

### Documentos troncales

- [Modelo de acceso y login](docs/AUTH_ACCESS_MODEL.md)
- [Runbook de incidentes de acceso](docs/RUNBOOK_AUTH_ACCESS_INCIDENTS.md)
- [Arquitectura global](docs/ARCHITECTURE.md)
- [Runbook de sync y resiliencia](docs/RUNBOOK_SYNC_RESILIENCE.md)
- [Checklist diario admin (1 pagina)](docs/RUNBOOK_DAILY_ADMIN_CHECKLIST.md)
- [Runbook técnico de soporte](docs/RUNBOOK_SUPPORT_OPERATIONS.md)
- [Guardrails de calidad](docs/QUALITY_GUARDRAILS.md)
- [Gates de CI y runbooks de falla](docs/CI_GATES_AND_FAILURE_RUNBOOKS.md)
- [Scorecard de release readiness](reports/release-readiness-scorecard.md)
- [Gobernanza de guardrails](reports/guardrail-governance.md)
- [Política de cambio sostenible](reports/sustainable-change-policy.md)
- [Checklist de cambio seguro](docs/SAFE_CHANGE_CHECKLIST.md)
- [Definition of Done técnico](docs/ENGINEERING_DEFINITION_OF_DONE.md)
- [Registro de deuda técnica](docs/TECHNICAL_DEBT_REGISTER.md)
- [ADR Repository Provider obligatorio](docs/ADR_REPOSITORY_PROVIDER_REQUIRED.md)
- [ADR fachada de access policy](docs/ADR_ACCESS_POLICY_FACADE.md)
- [ADR boundary de application](docs/ADR_APPLICATION_BOUNDARY_ENFORCEMENT.md)
- [ADR daily-record runtime path](docs/ADR_DAILY_RECORD_RUNTIME_PATH.md)
- [ADR auth runtime recovery](docs/ADR_AUTH_RUNTIME_RECOVERY.md)
- [ADR clinical-documents workspace contract](docs/ADR_CLINICAL_DOCUMENT_WORKSPACE_CONTRACT.md)
- [ADR handoff runtime surfaces](docs/ADR_HANDOFF_RUNTIME_SURFACES.md)
- [Mapa de código fuente](src/README.md)

### Documentación existente relevante

- [docs/architecture.md](docs/architecture.md)
- [docs/data-flow.md](docs/data-flow.md)
- [docs/system-behaviors.md](docs/system-behaviors.md)
- [docs/testing/README.md](docs/testing/README.md)

### READMEs por directorio principal de `src/`

- [src/adapters/README.md](src/adapters/README.md)
- [src/assets/README.md](src/assets/README.md)
- [src/components/README.md](src/components/README.md)
- [src/config/README.md](src/config/README.md)
- [src/constants/README.md](src/constants/README.md)
- [src/context/README.md](src/context/README.md)
- [src/core/README.md](src/core/README.md)
- [src/docs/README.md](src/docs/README.md)
- [src/domain/README.md](src/domain/README.md)
- [src/features/README.md](src/features/README.md)
- [src/hooks/README.md](src/hooks/README.md)
- [src/infrastructure/README.md](src/infrastructure/README.md)
- [src/schemas/README.md](src/schemas/README.md)
- [src/services/README.md](src/services/README.md)
- [src/shared/README.md](src/shared/README.md)
- [src/styles/README.md](src/styles/README.md)
- [src/tests/README.md](src/tests/README.md)
- [src/types/README.md](src/types/README.md)
- [src/utils/README.md](src/utils/README.md)
- [src/views/README.md](src/views/README.md)

### READMEs de profundización (módulos críticos)

- [src/features/census/README.md](src/features/census/README.md)
- [src/hooks/controllers/README.md](src/hooks/controllers/README.md)
- [src/components/modals/README.md](src/components/modals/README.md)
- [src/services/repositories/README.md](src/services/repositories/README.md)
- [src/services/storage/README.md](src/services/storage/README.md)

## Testing

### Validación rápida recomendada

```bash
npm run typecheck
npm run check:quality
npm run test:risk:admin-health
npm run test:sync-load
```

### Suite completa

```bash
npm run test
```

### Cobertura

```bash
npm run test:coverage
```

### End-to-end

```bash
npm run test:e2e
npm run test:e2e:critical
E2E_CRITICAL_BROWSERS=chromium,firefox npm run test:e2e:critical
```

## Gates de CI (actual)

Mapa operativo resumido:

- `npm run ci:inner-loop`
- `npm run ci:merge-gate`
- `npm run ci:release-gate`

Runbook detallado:

- [docs/CI_GATES_AND_FAILURE_RUNBOOKS.md](docs/CI_GATES_AND_FAILURE_RUNBOOKS.md)

Artifacts operativos publicados por CI:

- `quality-metrics`
- `operational-health`
- `runtime-contracts`
- `critical-coverage`
- `flow-performance-budget`

## Baseline de Calidad

Snapshot vigente en [reports/quality-metrics.md](reports/quality-metrics.md).

Para evitar desalineación, los conteos exactos de archivos, líneas y tests deben leerse desde ese reporte generado.

## Notas Operativas Recientes

- **Auth por entorno:** el acceso alternativo de Google se valida contra la configuración real de Firebase antes de intentarse. En `localhost` queda desactivado por defecto para evitar bucles y la app muestra advertencias tempranas si faltan variables críticas de Firebase.
- **Fallback local:** si IndexedDB falla tras borrar datos del sitio o por un problema del navegador, la app intenta una recuperación automática antes de mostrar avisos al usuario.
- `0` archivos marcados con flake-risk

Validación usada para esta línea base:

```bash
npm run typecheck
npm run lint -- --max-warnings 0
npm run check:quality
npm run test:ci:unit
npm run report:quality-metrics
```

### Próximo hotspot recomendado

Hotspots secundarios:

- `src/services/integrations/whatsapp/whatsappService.ts`
- `src/hooks/useAuthState.ts`
- `src/features/auth/components/LoginPage.tsx`
- `src/services/cudyr/cudyrWorkbookBuilder.ts`
- `src/features/handoff/components/HandoffCudyrPrint.tsx`

## Convenciones de Calidad (resumen)

- Controladores (`controllers`) y hooks no deben importar implementaciones de componentes.
- Se controla deuda arquitectónica con `scripts/check-architecture.mjs`.
- Se controla tamaño máximo por módulo con `scripts/check-module-size.mjs`.
- Se controlan boundaries runtime para evitar acoplamiento directo a `window/alert/confirm` en zonas críticas.

> ⚠️ IMPORTANT: When modifying any layer, update the corresponding README.md in that directory.
