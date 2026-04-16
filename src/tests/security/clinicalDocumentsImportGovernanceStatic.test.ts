import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../');

describe('Clinical documents import governance', () => {
  it('keeps external modules out of deep clinical-documents imports', () => {
    const command =
      'grep -R "@/features/clinical-documents/" src --include="*.ts" --include="*.tsx" ' +
      '| grep -v "src/features/clinical-documents/" ' +
      '| grep -v "src/tests/" ' +
      '| grep -v "from \'@/features/clinical-documents/internal\'" ' +
      '| grep -v "from \\"@/features/clinical-documents/internal\\"" ' +
      '| grep -v "from \'@/features/clinical-documents/public\'" ' +
      '| grep -v "from \\"@/features/clinical-documents/public\\""';

    let rawOutput = '';
    try {
      rawOutput = execSync(command, { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch (error) {
      const execError = error as { status?: number; stdout?: string | Buffer };
      const stdout = String(execError.stdout || '').trim();
      if (execError.status === 1 && stdout.length === 0) {
        rawOutput = '';
      } else {
        throw error;
      }
    }

    expect(rawOutput).toBe('');
  });
});
