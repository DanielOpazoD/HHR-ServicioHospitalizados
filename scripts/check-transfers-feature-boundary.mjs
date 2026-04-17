#!/usr/bin/env node

import { runFeatureBoundaryCheck } from './lib/featureBoundaryRunner.mjs';

runFeatureBoundaryCheck({
  feature: 'transfers',
  label: 'Transfers',
});
