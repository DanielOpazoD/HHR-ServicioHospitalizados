import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const configPath = path.join(rootDir, 'scripts/config/flaky-quarantine.json');

const fail = message => {
  console.error(`[flaky-quarantine] ${message}`);
  process.exit(1);
};

if (!fs.existsSync(configPath)) {
  fail(`Missing config file: ${configPath}`);
}

const raw = fs.readFileSync(configPath, 'utf8');
let parsed;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  fail(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

const quarantined = Array.isArray(parsed?.quarantined) ? parsed.quarantined : null;
if (!quarantined) {
  fail('Expected { "quarantined": [] }');
}

const now = new Date();
const errors = [];

for (const [index, entry] of quarantined.entries()) {
  const label = `entry[${index}]`;
  const file = typeof entry?.file === 'string' ? entry.file.trim() : '';
  const owner = typeof entry?.owner === 'string' ? entry.owner.trim() : '';
  const sla = typeof entry?.sla === 'string' ? entry.sla.trim() : '';
  const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : '';

  if (!file) errors.push(`${label}: missing file`);
  if (!owner) errors.push(`${label}: missing owner`);
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
    } else if (slaDate.getTime() < now.getTime()) {
      errors.push(`${label}: SLA expired (${sla}) for ${file || 'unknown file'}`);
    }
  }
}

if (errors.length > 0) {
  console.error('[flaky-quarantine] Validation failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.warn(`[flaky-quarantine] OK (${quarantined.length} quarantined test entries)`);
