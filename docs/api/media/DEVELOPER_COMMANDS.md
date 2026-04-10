# Developer Commands

Este documento separa los comandos oficiales del repo de los scripts internos o especializados. La regla es simple:

- si trabajas día a día en la app, usa primero los comandos oficiales;
- si necesitas diagnóstico, auditoría o una validación puntual, entra a los scripts especializados;
- no memorices los `139` scripts del `package.json`: usa este mapa.

## Comandos oficiales

Estos son los entrypoints recomendados para trabajo normal.

| Comando                   | Cuándo usarlo                                          |
| ------------------------- | ------------------------------------------------------ |
| `npm run dev`             | desarrollo local de la app                             |
| `npm run typecheck`       | validar tipos antes de subir cambios                   |
| `npm run lint`            | validar lint global                                    |
| `npm run test:ci:unit`    | suite unitaria/integración base sin emuladores         |
| `npm run check:quality`   | guardrails estructurales y de gobernanza               |
| `npm run ci:inner-loop`   | verificación local rápida antes de seguir iterando     |
| `npm run ci:pre-merge`    | gate compacto antes de merge                           |
| `npm run ci:merge-gate`   | gate blocking ampliado para cambios sensibles          |
| `npm run ci:release-gate` | validación final con Firestore/emuladores/E2E críticos |

## Comandos oficiales por escenario

### Desarrollo diario

1. `npm run dev`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run ci:inner-loop`

### Antes de merge

1. `npm run ci:pre-merge`
2. Si el cambio toca runtime clínico, storage, auth, bundle o boundaries críticos: `npm run ci:merge-gate`

### Antes de release o validación operativa fuerte

1. `npm run ci:release-gate`

## Scripts especializados

Estos scripts siguen soportados, pero no forman parte de la superficie pública mínima.

### Testing especializado

- `npm run test:rules`
- `npm run test:rules:ci`
- `npm run test:emulator:sync`
- `npm run test:emulator:ui`
- `npm run test:e2e`
- `npm run test:e2e:critical`
- `npm run test:e2e:flow-performance`
- `npm run test:release-confidence`
- `npm run test:release-confidence:full`
- `npm run test:coverage`
- `npm run test:coverage:critical`

### Checks de gobernanza y arquitectura

- `npm run check:repo-hygiene`
- `npm run check:architecture`
- `npm run check:guardrail-governance`
- `npm run check:runtime-contracts`
- `npm run check:critical-coverage`
- `npm run check:flow-performance-budget`
- `npm run check:security`

### Reportes y auditoría

- `npm run report:quality-metrics`
- `npm run report:operational-health`
- `npm run report:system-confidence`
- `npm run report:architectural-hotspots`
- `npm run report:release-readiness-scorecard`
- `npm run report:runtime-contracts`

## Convención operativa

- `dev`, `typecheck`, `lint`, `test:ci:unit`, `check:quality` y `ci:*` son la superficie pública recomendada.
- `check:*`, `report:*` y `test:*` más específicos deben tratarse como herramientas de diagnóstico o validación focalizada.
- Si aparece un script nuevo que debería usar casi todo el equipo, debe entrar a esta lista oficial o no vale la pena publicitarlo.
