#!/usr/bin/env node

import { runFeatureBoundaryCheck } from './lib/featureBoundaryRunner.mjs';

runFeatureBoundaryCheck({
  feature: 'clinical-documents',
  label: 'Clinical-documents',
  extraPublicModules: ['@/features/clinical-documents/internal'],
});
