#!/usr/bin/env node

import { getRuleAssetDrift } from './rulesSourceSupport.mjs';

const drift = getRuleAssetDrift(process.cwd());

if (drift.length === 0) {
  console.log('[rules-assets] Generated rules are in sync with source fragments.');
  process.exit(0);
}

console.error('[rules-assets] Generated rules are out of sync:');
for (const entry of drift) {
  console.error(`- ${entry.output}`);
  for (const source of entry.sources) {
    console.error(`  - ${source}`);
  }
}
console.error('Run `node scripts/build-rules-assets.mjs` and commit the regenerated rules files.');
process.exit(1);
