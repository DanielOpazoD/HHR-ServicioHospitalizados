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

## Validation

- Run `npm run build` after any `manualChunks` change.
- Run the focused test `vitest run src/tests/build/chunkingPolicy.test.ts`.
- If a new chunk is introduced for backup/shared census, inspect the built assets and confirm there is no two-way chunk import.
