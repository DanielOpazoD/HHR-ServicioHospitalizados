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

  it('uses robust admin check in setUserRole callable', () => {
    const functionsIndex = readProjectFile('functions/index.js');

    // Regression guard for precedence bug: !context.auth.token.role === 'admin'
    expect(functionsIndex).not.toContain('!context.auth.token.role ===');
    expect(functionsIndex).toContain("const hasAdminClaim = context.auth?.token?.role === 'admin'");
  });

  it('restricts dailyRecords delete operation to admins only', () => {
    const rules = readProjectFile('firestore.rules');

    expect(rules).toMatch(/match \/dailyRecords\/\{date\}[\s\S]*allow delete:\s*if isAdmin\(\);/m);
    expect(rules).not.toMatch(
      /match \/dailyRecords\/\{date\}[\s\S]*allow delete:\s*if [^;]*isNurse\(/m
    );
  });
});
