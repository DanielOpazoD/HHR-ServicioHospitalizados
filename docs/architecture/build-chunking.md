# Build Chunking

## Purpose

- Keep production chunking predictable and safe for Netlify/Vite deploys.
- Prevent production-only initialization failures caused by cross-chunk import cycles.

## Current policy

- The source of truth for manual chunk classification is [scripts/config/chunkingPolicy.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/scripts/config/chunkingPolicy.ts).
- [vite.config.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/vite.config.ts) consumes that policy directly instead of duplicating chunk rules inline.

## Important guardrail

- Do not create a dedicated manual chunk for `shared-census` storage modules while they still share imports with `feature-backup-storage`.
- This previously produced a production-only cycle between `feature-shared-census-storage` and `feature-backup-storage`, which crashed Netlify with `Cannot access '<symbol>' before initialization`.

## Safe chunking rule

- Group tightly coupled backup/storage modules under `feature-backup-storage` unless they have a proven isolated runtime boundary.
- Only split a new manual chunk when:
  - the module graph is one-directional,
  - the feature can initialize without importing back into the parent chunk,
  - the production build is validated after the change.

## Feature-oriented loading strategy

- `feature-census-runtime` agrupa controladores y validaciones del censo diario.
- `feature-census-patient-row` aísla la fila/panel de paciente, que se carga con patrones de interacción distintos.
- `feature-clinical-documents` y `feature-transfers` se mantienen separados porque cargan flujos documentales pesados y no deben inflar el arranque base del censo.
- `feature-backup-storage` conserva juntos exportación y storage porque comparten un grafo estrechamente acoplado; no se debe volver a separar `shared census` de ese bloque sin demostrar un runtime boundary real.

## Vendor strategy

- `vendor-firebase-core`: auth + firestore + módulos base usados en la mayor parte del runtime.
- `vendor-firebase-aux`: storage/functions, cargados solo cuando se necesitan capacidades auxiliares.
- `vendor-three-*`: separar `core`, `react` y `stdlib` evita arrastrar todo el stack 3D al arranque normal.
- `vendor-pdf` y `vendor-excel-*`: la generación documental y exportaciones deben seguir siendo capacidades lazy y aisladas del shell principal.

## Validation

- Run `npm run build` after any `manualChunks` change.
- Run the focused test `vitest run src/tests/build/chunkingPolicy.test.ts`.
- If a new chunk is introduced for backup/shared census, inspect the built assets and confirm there is no two-way chunk import.
