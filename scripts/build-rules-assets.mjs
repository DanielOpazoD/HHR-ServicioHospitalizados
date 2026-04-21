#!/usr/bin/env node

import { writeRuleAssets } from './rulesSourceSupport.mjs';

writeRuleAssets(process.cwd());
console.log('[rules-assets] Generated firestore.rules and storage.rules from source fragments.');
