import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../');

describe('DailyRecord contracts import governance', () => {
  it('keeps the temporary dailyRecordContracts aggregator out of production imports', () => {
    const command =
      'grep -rl "from \'@/application/shared/dailyRecordContracts\'\\|from \\"@/application/shared/dailyRecordContracts\\"" src --include="*.ts" --include="*.tsx" | grep -v "src/tests/"';

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
    const referencedFiles = rawOutput
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    expect(referencedFiles).toEqual([]);
  });
});
