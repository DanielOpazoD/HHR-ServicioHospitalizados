#!/usr/bin/env node

import path from 'node:path';
import { runFeatureBoundaryCheck } from './lib/featureBoundaryRunner.mjs';

// Governed exception: src/hooks/controllers/*.ts may be a trivial re-export shim
// pointing at the matching feature controller. Keeps the legacy import path alive
// without allowing arbitrary deep imports into the feature.
const isGovernedCensusControllerShim = ({ importerPath, importPath, source }) => {
  if (!importerPath.startsWith('src/hooks/controllers/')) return false;
  if (!importPath.startsWith('@/features/census/controllers/')) return false;

  const importerModule = path.basename(importerPath, path.extname(importerPath));
  const expectedSource = `export * from '@/features/census/controllers/${importerModule}';`;
  return source.trim() === expectedSource;
};

runFeatureBoundaryCheck({
  feature: 'census',
  label: 'Census',
  // Heavy-component entrypoint, split out from public.ts so external static
  // importers do not pull CensusView into their chunks. Callers must use a
  // dynamic import() for this module (enforced by convention, not by lint).
  extraPublicModules: ['@/features/census/public-components'],
  allowException: isGovernedCensusControllerShim,
});
