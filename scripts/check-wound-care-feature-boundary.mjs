#!/usr/bin/env node

import { runFeatureBoundaryCheck } from './lib/featureBoundaryRunner.mjs';

runFeatureBoundaryCheck({
  feature: 'wound-care',
  label: 'Wound-care',
});
