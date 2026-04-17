#!/usr/bin/env node

import { runFeatureModuleSizeCheck } from './lib/featureModuleSizeRunner.mjs';

runFeatureModuleSizeCheck({
  configFile: 'scripts/handoff-module-size-limits.json',
  label: 'Handoff',
});
