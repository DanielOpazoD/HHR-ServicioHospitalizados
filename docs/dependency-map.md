# Dependency Map (Carpetas `src`)

Este documento define responsabilidades por carpeta y el contrato de dependencias permitido.
El contrato ejecutable vive en:

- `/Users/danielopazodamiani/Desktop/FEB 10 2144/scripts/folder-dependency-matrix.json`
- `/Users/danielopazodamiani/Desktop/FEB 10 2144/scripts/check-folder-dependencies.mjs`

## Objetivo

- Reducir acoplamiento entre capas.
- Evitar dependencias inversas (por ejemplo, lógica de dominio importando UI).
- Permitir refactor incremental con deuda controlada por allowlist.

## Reglas Ejecutables (zonas gobernadas)

| Zona         | Rol                                          | Puede importar                                                                                                                                             |
| ------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features`   | Módulos funcionales y orquestación de flujo  | `components`, `hooks`, `context`, `services`, `domain`, `types`, `constants`, `utils`, `shared`, `schemas`, `config`, `core`, `adapters`, `infrastructure` |
| `components` | Composición de UI reutilizable               | `hooks`, `context`, `services`, `types`, `constants`, `utils`, `shared`, `schemas`, `core`                                                                 |
| `hooks`      | Comportamiento reusable y orquestación de UI | `services`, `context`, `types`, `constants`, `utils`, `shared`, `schemas`, `config`                                                                        |
| `context`    | Estado global y contratos de provider        | `hooks`, `services`, `types`, `constants`, `utils`, `shared`                                                                                               |
| `services`   | Operaciones de negocio, I/O e integraciones  | `types`, `constants`, `utils`, `schemas`, `shared`, `config`                                                                                               |
| `domain`     | Reglas de dominio puras                      | `types`, `constants`, `utils`                                                                                                                              |
| `core`       | Primitivas transversales de la app           | `types`, `constants`, `utils`, `shared`, `services`                                                                                                        |

## Convenciones de diseño

- `services` no depende de UI (`components`, `hooks`, `context`, `features`).
- `domain` no depende de capas de aplicación/UI.
- `context` solo coordina estado y casos de uso; no renderiza UI de `components`.
- `components` y `hooks` son capas consumidoras, no dueñas de reglas de negocio.

## Flujo de trabajo recomendado

1. Si agregas una dependencia nueva entre zonas, primero valida si respeta la matriz.
2. Si necesitas romper la regla por migración, agrega el caso a allowlist con justificación en PR.
3. En paralelo, crea tarea para remover ese item de allowlist.

## CI / Checks

- `npm run check:folder-dependencies` valida nuevas violaciones.
- `npm run check:quality` incluye este check en la cadena completa.
