#!/usr/bin/env node

import { runRestrictedImportCheck } from './lib/restrictedImportRunner.mjs';

runRestrictedImportCheck({
  label: 'Handoff PDF contract boundary',
  targetPaths: ['src/services/pdf'],
  restrictedImport: '@/services/contracts/dailyRecordServiceContracts',
  allowedImporters: ['src/services/pdf/contracts/handoffPdfContracts.ts'],
});
