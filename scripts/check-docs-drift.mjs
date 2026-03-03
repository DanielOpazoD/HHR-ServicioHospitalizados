#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();

const checks = [
  {
    file: 'src/services/repositories/README.md',
    patterns: [
      'legacyRecordBridgeService.ts',
      'legacyBridgeGovernance.ts',
      'reports/legacy-bridge-governance.md',
      'schemaEvolutionPolicy.ts',
      'migrationLedger.ts',
      'dailyRecordAggregate.ts',
      'reports/schema-evolution.md',
    ],
  },
  {
    file: 'src/services/storage/README.md',
    patterns: [
      'sync/syncQueueEngine.ts',
      'firestore/firestoreQuerySupport.ts',
      'firestore/firestoreWriteSupport.ts',
      'syncQueueService.ts',
    ],
  },
];

const fail = message => {
  console.error(`[docs-drift] ${message}`);
  process.exit(1);
};

for (const check of checks) {
  const filePath = path.join(workspaceRoot, check.file);
  const content = fs.readFileSync(filePath, 'utf8');
  const missing = check.patterns.filter(pattern => !content.includes(pattern));
  if (missing.length > 0) {
    fail(`${check.file} is missing references to: ${missing.join(', ')}`);
  }
}

console.log('[docs-drift] OK');
