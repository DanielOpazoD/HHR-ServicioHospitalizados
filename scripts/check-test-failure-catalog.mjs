import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const configPath = path.join(rootDir, 'scripts/config/test-failure-catalog.json');
const flakyQuarantinePath = path.join(rootDir, 'scripts/config/flaky-quarantine.json');

const VALID_CLASSIFICATIONS = new Set([
  'deterministic',
  'flaky',
  'infra',
  'test_obsolete',
  'bug_real',
]);
const VALID_STATUSES = new Set(['open', 'quarantined', 'fixed']);

const fail = message => {
  console.error(`[test-failure-catalog] ${message}`);
  process.exit(1);
};

const readJson = filePath => {
  if (!fs.existsSync(filePath)) {
    fail(`Missing config file: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const catalog = readJson(configPath);
const quarantine = readJson(flakyQuarantinePath);

if (catalog?.version !== 1) {
  fail('Expected catalog version 1.');
}

if (!Array.isArray(catalog?.entries)) {
  fail('Expected { "version": 1, "entries": [] }.');
}

const quarantineFiles = new Set(
  Array.isArray(quarantine?.quarantined)
    ? quarantine.quarantined
        .map(entry => (typeof entry?.file === 'string' ? entry.file.trim() : ''))
        .filter(Boolean)
    : []
);

const errors = [];
const now = new Date();
const seenKeys = new Set();
const openByFile = new Set();

for (const [index, entry] of catalog.entries.entries()) {
  const label = `entry[${index}]`;
  const file = typeof entry?.file === 'string' ? entry.file.trim() : '';
  const command = typeof entry?.command === 'string' ? entry.command.trim() : '';
  const owner = typeof entry?.owner === 'string' ? entry.owner.trim() : '';
  const status = typeof entry?.status === 'string' ? entry.status.trim() : '';
  const classification = typeof entry?.classification === 'string' ? entry.classification.trim() : '';
  const sla = typeof entry?.sla === 'string' ? entry.sla.trim() : '';
  const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : '';

  if (!file) errors.push(`${label}: missing file`);
  if (!command) errors.push(`${label}: missing command`);
  if (!owner) errors.push(`${label}: missing owner`);
  if (!VALID_STATUSES.has(status)) errors.push(`${label}: invalid status ${status || '(empty)'}`);
  if (!VALID_CLASSIFICATIONS.has(classification)) {
    errors.push(`${label}: invalid classification ${classification || '(empty)'}`);
  }
  if (!sla) errors.push(`${label}: missing sla (YYYY-MM-DD)`);
  if (!reason) errors.push(`${label}: missing reason`);

  if (file) {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) {
      errors.push(`${label}: file does not exist: ${file}`);
    }
  }

  if (sla) {
    const slaDate = new Date(`${sla}T00:00:00.000Z`);
    if (Number.isNaN(slaDate.getTime())) {
      errors.push(`${label}: invalid sla date: ${sla}`);
    } else if (status !== 'fixed' && slaDate.getTime() < now.getTime()) {
      errors.push(`${label}: SLA expired (${sla}) for ${file || 'unknown file'}`);
    }
  }

  if (file && command) {
    const key = `${file}|${command}`;
    if (seenKeys.has(key)) {
      errors.push(`${label}: duplicate file/command pair ${key}`);
    }
    seenKeys.add(key);
  }

  if (status !== 'fixed' && file) {
    openByFile.add(file);
  }

  if (classification === 'flaky' && status !== 'fixed' && file && !quarantineFiles.has(file)) {
    errors.push(`${label}: flaky entry must also exist in scripts/config/flaky-quarantine.json`);
  }
}

for (const file of quarantineFiles) {
  if (!openByFile.has(file)) {
    errors.push(`quarantine entry missing from test failure catalog: ${file}`);
  }
}

if (errors.length > 0) {
  console.error('[test-failure-catalog] Validation failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

const openEntries = catalog.entries.filter(entry => entry.status !== 'fixed').length;
console.warn(`[test-failure-catalog] OK (${openEntries} open classified entries)`);
