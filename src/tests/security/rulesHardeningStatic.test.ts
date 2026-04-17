import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const readProjectFile = (relativePath: string): string => {
  const absolutePath = path.resolve(__dirname, '../../../', relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
};

describe('Security hardening static guards', () => {
  it('does not expose public Firestore reads in sensitive collections', () => {
    const rules = readProjectFile('firestore.rules');

    expect(rules).not.toMatch(/match \/bookmarks\/\{bookmarkId\}\s*\{\s*allow read:\s*if true;/m);
    expect(rules).not.toMatch(
      /match \/census-access-invitations\/\{invitationId\}\s*\{\s*allow read:\s*if true;/m
    );
  });

  it('does not expose public Storage reads for censo-diario', () => {
    const rules = readProjectFile('storage.rules');
    expect(rules).not.toMatch(
      /match \/censo-diario\/\{allPaths=\*\*\}\s*\{\s*allow read:\s*if true;/m
    );
  });

  it('keeps reminders storage writes restricted to admin claims or bootstrap admin', () => {
    const rules = readProjectFile('storage.rules');
    expect(rules).toContain('match /reminders/{allPaths=**}');
    expect(rules).toContain('allow write: if canWriteReminderAssets();');
    expect(rules).not.toMatch(
      /match \/reminders\/\{allPaths=\*\*\}\s*\{\s*allow write:\s*if true;/m
    );
  });

  it('uses robust admin check in setUserRole callable', () => {
    const authCallablePolicy = readProjectFile('functions/lib/auth/authCallablePolicy.js');

    // Regression guard for precedence bug: !context.auth.token.role === 'admin'
    expect(authCallablePolicy).not.toContain('!context.auth.token.role ===');
    expect(authCallablePolicy).toContain(
      "const hasAdminClaim = context.auth?.token?.role === 'admin'"
    );
  });

  it('restricts dailyRecords delete operation to admins only', () => {
    const rules = readProjectFile('firestore.rules');
    const dailyRecordsMatch = rules.match(
      /match \/dailyRecords\/\{date\}\s*\{([\s\S]*?)\n\s*\}\n\n\s*\/\/ Deleted Records/m
    );

    expect(dailyRecordsMatch).not.toBeNull();
    const dailyRecordsBlock = dailyRecordsMatch?.[1] || '';

    expect(dailyRecordsBlock).toMatch(/allow delete:\s*if isAdmin\(\);/m);
    expect(dailyRecordsBlock).not.toMatch(/allow delete:\s*if [^;]*isNurse\(/m);
  });

  // Regression guard: the bootstrap admin allowlist is a technical recovery path.
  // Any change (addition, removal, reorder, rename) must be an explicit PR that updates
  // this test — it forces human review of who holds recovery access.
  // If you need to change it, update both firestore.rules and EXPECTED_BOOTSTRAP_ADMINS below.
  it('freezes the bootstrap admin allowlist', () => {
    const EXPECTED_BOOTSTRAP_ADMINS = [
      'daniel.opazo@hospitalhangaroa.cl',
      'd.opazo.damiani@gmail.com',
    ];

    const rules = readProjectFile('firestore.rules');
    const fnMatch = rules.match(
      /function isBootstrapAdmin\(\)\s*\{[\s\S]*?getUserEmail\(\) in \[([\s\S]*?)\]/m
    );

    expect(fnMatch, 'isBootstrapAdmin() must exist with an inline allowlist').not.toBeNull();

    const listBody = fnMatch?.[1] ?? '';
    const foundEmails = Array.from(listBody.matchAll(/'([^']+)'/g)).map(m => m[1]);

    expect(foundEmails).toEqual(EXPECTED_BOOTSTRAP_ADMINS);
  });
});
