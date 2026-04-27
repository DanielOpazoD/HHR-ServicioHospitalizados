#!/usr/bin/env node

import { collectFirestoreEmulatorGovernanceIssues } from './firestoreEmulatorGovernanceSupport.mjs';

const issues = collectFirestoreEmulatorGovernanceIssues();

if (issues.length > 0) {
  console.error('[firestore-emulator-governance] Emulator validation wiring is incomplete:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('[firestore-emulator-governance] OK');
