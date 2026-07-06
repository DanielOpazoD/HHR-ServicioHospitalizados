import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const tempFiles: string[] = [];

const writeTempInput = (content: string) => {
  const filePath = path.join(os.tmpdir(), `ci-runtime-observed-${randomUUID()}.json`);
  fs.writeFileSync(filePath, content, 'utf8');
  tempFiles.push(filePath);
  return filePath;
};

const runReportScript = (inputPath: string) =>
  execFileSync(
    process.execPath,
    ['scripts/report-ci-runtime-observed-profile.mjs', '--input', inputPath],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
    }
  );

afterEach(() => {
  for (const filePath of tempFiles.splice(0)) {
    fs.rmSync(filePath, { force: true });
  }
});

describe('CI runtime telemetry scripts', () => {
  it('fails with an actionable message when the observed input JSON is malformed', () => {
    const inputPath = writeTempInput('{bad json');

    expect(() => runReportScript(inputPath)).toThrow(
      /Could not parse .*ci-runtime-observed.* JSON/
    );
  });

  it('fails with an actionable message when the observed input does not contain a jobs array', () => {
    const inputPath = writeTempInput('{"jobs":{"not":"an-array"}}\n');

    expect(() => runReportScript(inputPath)).toThrow(
      /must be an array of jobs or an object with a jobs array/
    );
  });
});
