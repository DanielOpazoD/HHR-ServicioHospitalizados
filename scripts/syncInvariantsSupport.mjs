import fs from 'node:fs';
import path from 'node:path';

const readText = (root, filePath) => fs.readFileSync(path.join(root, filePath), 'utf8');

const buildInvariant = (id, ok, description, evidence = []) => ({
  id,
  ok,
  description,
  evidence,
});

const productionRepositoryFiles = root => {
  const repositoryRoot = path.join(root, 'src/services/repositories');
  const visit = directory =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return visit(absolutePath);
      }
      return entry.isFile() && absolutePath.endsWith('.ts') ? [absolutePath] : [];
    });
  return visit(repositoryRoot);
};

const hasVoidLocalPersistenceImport = (root, filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  return /import\s*\{[^}]*\b(?:saveRecord|saveRecords|deleteRecord)\b(?!Strict)[^}]*\}\s*from\s*['"]@\/services\/storage\/indexeddb\/indexedDbRecordService['"]/.test(
    source
  );
};

export const evaluateSyncInvariants = root => {
  const packageJson = JSON.parse(readText(root, 'package.json'));
  const ports = readText(root, 'src/services/storage/sync/syncQueuePorts.ts');
  const engine = readText(root, 'src/services/storage/sync/syncQueueEngine.ts');
  const telemetry = readText(root, 'src/services/storage/sync/syncQueueTelemetryController.ts');
  const envExample = readText(root, '.env.example');
  const runbook = readText(root, 'docs/RUNBOOK_SYNC_RESILIENCE.md');

  const repositoryOffenders = productionRepositoryFiles(root)
    .filter(filePath => hasVoidLocalPersistenceImport(root, filePath))
    .map(filePath => path.relative(root, filePath));

  const invariants = [
    buildInvariant(
      'atomic-sync-claim-api',
      ports.includes('claimReadyPending') && !ports.includes('listReadyPending'),
      'Sync queue workers must atomically claim ready tasks instead of listing and updating separately.',
      ['syncQueuePorts.ts']
    ),
    buildInvariant(
      'claimed-completion-telemetry',
      engine.includes('recordSyncQueueStaleClaimTelemetry') &&
        telemetry.includes("operation: 'sync_queue_stale_claim_noop'"),
      'Claimed task completion/update no-ops must be observable as recoverable stale-claim telemetry.',
      ['syncQueueEngine.ts', 'syncQueueTelemetryController.ts']
    ),
    buildInvariant(
      'authority-release-gate',
      packageJson.scripts?.['ci:release-gate']?.includes(
        'check:daily-record-authority-release-gate'
      ) &&
        envExample.includes('Release must use VITE_DAILY_RECORD_AUTHORITY_MODE=enforced'),
      'Release writes must require daily-record authority mode and document the deploy env flag.',
      ['package.json', '.env.example']
    ),
    buildInvariant(
      'strict-repository-local-persistence',
      repositoryOffenders.length === 0,
      'Critical repository writes must avoid void local persistence wrappers.',
      repositoryOffenders.length > 0 ? repositoryOffenders : ['src/services/repositories']
    ),
    buildInvariant(
      'sync-runbook',
      runbook.includes('PROCESSING` con `leaseUntil` vencido') &&
        runbook.includes('sync_queue_stale_claim_noop'),
      'The sync runbook must explain expired leases and stale-claim telemetry for support.',
      ['docs/RUNBOOK_SYNC_RESILIENCE.md']
    ),
  ];

  return {
    ok: invariants.every(invariant => invariant.ok),
    invariants,
  };
};

export const formatSyncInvariantsReport = result => {
  const lines = ['# Sync Invariants', ''];
  for (const invariant of result.invariants) {
    lines.push(
      `- ${invariant.ok ? 'OK' : 'FAIL'} ${invariant.id}: ${invariant.description}`
    );
    if (!invariant.ok && invariant.evidence.length > 0) {
      lines.push(`  Evidence: ${invariant.evidence.join(', ')}`);
    }
  }
  return `${lines.join('\n')}\n`;
};
