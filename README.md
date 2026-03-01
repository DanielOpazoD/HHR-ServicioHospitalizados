# HHR (Hospital Handoff Record)

Aplicación web médica para censo hospitalario, entrega de turno y gestión operativa clínica.

## Quick Start

### Requisitos

- Node.js 20+
- npm 10+
- Firebase project (variables de entorno en `.env`)

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

## Comandos Principales

| Comando                          | Objetivo                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev`                    | Levantar app en modo desarrollo                                                        |
| `npm run build`                  | Build de producción                                                                    |
| `npm run preview`                | Preview local del build                                                                |
| `npm run typecheck`              | Verificación TypeScript                                                                |
| `npm run test`                   | Suite Vitest completa                                                                  |
| `npm run test:watch`             | Vitest en watch mode                                                                   |
| `npm run test:coverage`          | Cobertura de tests                                                                     |
| `npm run test:e2e`               | End-to-end (Playwright)                                                                |
| `npm run test:e2e:critical`      | E2E crítico emulador (Chromium por defecto; multi-browser por `E2E_CRITICAL_BROWSERS`) |
| `npm run lint`                   | Lint global                                                                            |
| `npm run check:quality`          | Checks de arquitectura, tamaño de módulo y boundaries runtime                          |
| `npm run test:rules`             | Tests de reglas Firestore                                                              |
| `npm run test:risk:admin-health` | Riesgo operativo de health dashboard y contratos                                       |
| `npm run report:quality-metrics` | Snapshot de métricas de calidad para artefactos CI                                     |

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

- [Arquitectura global](docs/ARCHITECTURE.md)
- [Runbook de sync y resiliencia](docs/RUNBOOK_SYNC_RESILIENCE.md)
- [Checklist diario admin (1 pagina)](docs/RUNBOOK_DAILY_ADMIN_CHECKLIST.md)
- [Runbook técnico de soporte](docs/RUNBOOK_SUPPORT_OPERATIONS.md)
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

La pipeline en `.github/workflows/ci-cd.yml` bloquea merge si falla alguno:

- Quality gates (`lint`, `typecheck`, `check:quality`)
- Unit/integration (`test:ci:unit`)
- Resiliencia crítica (`test:resilience`)
- Riesgo operativo admin health (`test:risk:admin-health`)
- Carga base de sync queue (`test:sync-load`)
- Firestore rules + sync emulator (`test:rules:ci`, `test:emulator:sync:ci`)
- E2E críticos con emulador (`test:e2e:critical:ci`)
- Build de producción (`build`)

## Baseline de Calidad

Snapshot vigente al `2026-03-01` en [reports/quality-metrics.md](reports/quality-metrics.md):

- `966` archivos fuente
- `95176` líneas fuente
- `0` módulos sobredimensionados
- `0` violaciones de deuda entre carpetas
- `0` explicit `any` en código fuente
- `474` archivos de test
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

## Convenciones de Calidad (resumen)

- Controladores (`controllers`) y hooks no deben importar implementaciones de componentes.
- Se controla deuda arquitectónica con `scripts/check-architecture.mjs`.
- Se controla tamaño máximo por módulo con `scripts/check-module-size.mjs`.
- Se controlan boundaries runtime para evitar acoplamiento directo a `window/alert/confirm` en zonas críticas.

> ⚠️ IMPORTANT: When modifying any layer, update the corresponding README.md in that directory.
