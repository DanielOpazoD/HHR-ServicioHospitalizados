#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const readFile = relativePath => {
  const absolutePath = path.join(root, relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
};

const checks = [
  {
    id: 'firestore-bookmarks-public-read',
    description: 'bookmarks must not be public-readable',
    file: 'firestore.rules',
    failIfMatches: /match \/bookmarks\/\{bookmarkId\}\s*\{[\s\S]*?allow read:\s*if true;/m,
  },
  {
    id: 'firestore-invitations-public-read',
    description: 'census invitations must not be public-readable',
    file: 'firestore.rules',
    failIfMatches: /match \/census-access-invitations\/\{invitationId\}\s*\{[\s\S]*?allow read:\s*if true;/m,
  },
  {
    id: 'storage-censo-public-read',
    description: 'censo-diario storage path must not expose public read',
    file: 'storage.rules',
    failIfMatches: /match \/censo-diario\/\{allPaths=\*\*\}\s*\{[\s\S]*?allow read:\s*if true;/m,
  },
  {
    id: 'authservice-static-whitelist-partial-match',
    description: 'auth whitelist must use exact email equality, not includes',
    file: 'src/services/auth/authService.ts',
    failIfMatches: /cleanEmail\.includes\(staticEmail\)/m,
  },
  {
    id: 'functions-admin-precedence-bug',
    description: 'setUserRole must not contain precedence bug in role check',
    file: 'functions/index.js',
    failIfMatches: /!context\.auth\.token\.role\s*===/m,
  },
  {
    id: 'functions-local-service-account-file',
    description: 'cloud functions must not load local service account key files',
    file: 'functions/index.js',
    failIfMatches: /require\(['"]\.\/llave-beta\.json['"]\)/m,
  },
  {
    id: 'legacy-public-token-secret',
    description: 'frontend must not embed TOKEN_SECRET-based public census tokens',
    file: 'src/utils/publicCensusToken.ts',
    failIfMatches: /TOKEN_SECRET|simpleHash\(/m,
  },
];

const failures = [];

for (const check of checks) {
  const content = readFile(check.file);
  if (check.failIfMatches.test(content)) {
    failures.push(check);
  }
}

if (failures.length > 0) {
  console.error('\nSecurity hardening checks failed:');
  for (const failure of failures) {
    console.error(`- [${failure.id}] ${failure.description} (${failure.file})`);
  }
  process.exit(1);
}

console.log('Security hardening checks passed.');
