#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const versionFilePath = path.join(workspaceRoot, 'src/constants/version.ts');
const governanceFilePath = path.join(workspaceRoot, 'src/services/repositories/schemaGovernance.ts');

const fail = message => {
  console.error(`[schema-governance] ${message}`);
  process.exit(1);
};

const readFile = filePath => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`Cannot read file ${filePath}: ${String(error)}`);
  }
};

const versionContent = readFile(versionFilePath);
const governanceContent = readFile(governanceFilePath);

const currentMatch = versionContent.match(/export const CURRENT_SCHEMA_VERSION\s*=\s*(\d+)\s*;/);
const legacyMatch = versionContent.match(/export const LEGACY_SCHEMA_VERSION\s*=\s*(\d+)\s*;/);

if (!currentMatch) fail('CURRENT_SCHEMA_VERSION not found in src/constants/version.ts');
if (!legacyMatch) fail('LEGACY_SCHEMA_VERSION not found in src/constants/version.ts');

const currentVersion = Number(currentMatch[1]);
const legacyVersion = Number(legacyMatch[1]);

if (!Number.isInteger(currentVersion) || !Number.isInteger(legacyVersion)) {
  fail('Schema versions must be integer numeric constants');
}

if (legacyVersion > currentVersion) {
  fail(`LEGACY_SCHEMA_VERSION (${legacyVersion}) cannot be greater than CURRENT_SCHEMA_VERSION (${currentVersion})`);
}

const registryBlockMatch = governanceContent.match(
  /const schemaMigrators\s*:\s*Record<number,\s*SchemaMigrator>\s*=\s*\{([\s\S]*?)\n\};/
);

if (!registryBlockMatch) {
  fail('schemaMigrators registry not found in src/services/repositories/schemaGovernance.ts');
}

const registryBlock = registryBlockMatch[1];
const keyMatches = [...registryBlock.matchAll(/^\s*(\d+)\s*:/gm)];
const configuredKeys = keyMatches.map(match => Number(match[1])).sort((a, b) => a - b);

const expectedKeys = [];
for (let version = legacyVersion; version < currentVersion; version += 1) {
  expectedKeys.push(version);
}

const missing = expectedKeys.filter(key => !configuredKeys.includes(key));
const extra = configuredKeys.filter(key => !expectedKeys.includes(key));

if (missing.length > 0 || extra.length > 0) {
  fail(
    `Invalid migrator registry. Missing [${missing.join(', ')}], extra [${extra.join(', ')}], expected [${expectedKeys.join(', ')}], configured [${configuredKeys.join(', ')}]`
  );
}

console.log(
  `[schema-governance] OK (legacy=v${legacyVersion}, current=v${currentVersion}, migrators=[${configuredKeys.join(', ')}])`
);
