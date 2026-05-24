import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = path.join(process.cwd(), 'src');
const SERVICES_ROOT = path.join(SOURCE_ROOT, 'services');
const ALLOWED_LEGACY_QUEUE_FILES = new Set([
  path.join(SERVICES_ROOT, 'storage/sync/publicSyncQueue.ts'),
  path.join(SERVICES_ROOT, 'storage/sync/index.ts'),
]);

const listSourceFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(absolutePath);
    }
    return entry.isFile() && absolutePath.endsWith('.ts') ? [absolutePath] : [];
  });

describe('critical daily-record sync outbox contract', () => {
  it('keeps production services off the legacy queueSyncTask API', () => {
    const offenders = listSourceFiles(SERVICES_ROOT).filter(filePath => {
      if (ALLOWED_LEGACY_QUEUE_FILES.has(filePath)) return false;
      const source = fs.readFileSync(filePath, 'utf8');
      return /\bqueueSyncTask\s*\(/.test(source) || /\bqueueSyncTask\b/.test(source);
    });

    expect(offenders.map(filePath => path.relative(process.cwd(), filePath))).toEqual([]);
  });
});
