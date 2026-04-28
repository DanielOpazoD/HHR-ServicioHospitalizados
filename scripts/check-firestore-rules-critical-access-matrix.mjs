import fs from 'node:fs';
import path from 'node:path';

import { findCriticalAccessMatrixDrift } from './firestoreRulesCriticalAccessMatrixSupport.mjs';

const root = process.cwd();
const rulesPath = path.join(root, 'firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');
const issues = findCriticalAccessMatrixDrift(rules);

if (issues.length > 0) {
  console.error('[firestore-rules-critical-access-matrix] Drift detected:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('[firestore-rules-critical-access-matrix] OK');
