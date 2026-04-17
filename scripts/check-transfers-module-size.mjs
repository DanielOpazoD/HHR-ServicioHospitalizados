#!/usr/bin/env node

import { runFeatureModuleSizeCheck } from './lib/featureModuleSizeRunner.mjs';

runFeatureModuleSizeCheck({
  configFile: 'scripts/transfers-module-size-limits.json',
  label: 'Transfers',
});
