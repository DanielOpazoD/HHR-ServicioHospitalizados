#!/usr/bin/env node

import { runFeatureModuleSizeCheck } from './lib/featureModuleSizeRunner.mjs';

runFeatureModuleSizeCheck({
  configFile: 'scripts/census-module-size-limits.json',
  label: 'Census',
});
