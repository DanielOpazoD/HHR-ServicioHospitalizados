#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.join('scripts', 'config', 'serverless-sensitive-coverage.json');

const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));

export const buildServerlessSensitiveCoverageReport = root => {
  const absoluteConfigPath = path.join(root, CONFIG_PATH);
  if (!fs.existsSync(absoluteConfigPath)) {
    throw new Error(`Missing ${CONFIG_PATH}`);
  }

  const config = readJson(absoluteConfigPath);
  const contractsDoc = String(config.contractsDoc || '').trim();
  const contractsDocPath = contractsDoc ? path.join(root, contractsDoc) : null;
  const contractsDocContent =
    contractsDocPath && fs.existsSync(contractsDocPath)
      ? fs.readFileSync(contractsDocPath, 'utf8')
      : '';

  const entries = Array.isArray(config.entries) ? config.entries : [];
  const issues = [];

  const normalizedEntries = entries.map(entry => {
    const id = String(entry?.id || '').trim();
    const functionFile = String(entry?.functionFile || '').trim();
    const endpoint = String(entry?.endpoint || '').trim();
    const testFiles = Array.isArray(entry?.testFiles)
      ? entry.testFiles.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim())
      : [];

    const missing = [];

    if (!id) missing.push('missing id');
    if (!functionFile) missing.push('missing functionFile');
    if (!endpoint) missing.push('missing endpoint');
    if (testFiles.length === 0) missing.push('missing testFiles');

    const functionExists = functionFile ? fs.existsSync(path.join(root, functionFile)) : false;
    if (functionFile && !functionExists) {
      missing.push(`missing function file ${functionFile}`);
    }

    const tests = testFiles.map(testFile => ({
      file: testFile,
      exists: fs.existsSync(path.join(root, testFile)),
    }));
    const missingTests = tests.filter(test => !test.exists).map(test => test.file);
    if (missingTests.length > 0) {
      missing.push(`missing tests ${missingTests.join(', ')}`);
    }

    const documentedInContracts =
      Boolean(contractsDocContent) && endpoint ? contractsDocContent.includes(`\`${endpoint}\``) : false;
    if (!documentedInContracts) {
      missing.push(`contracts doc missing endpoint ${endpoint}`);
    }

    const entryIssues = missing.map(message => `${id || functionFile || 'unknown'}: ${message}`);
    issues.push(...entryIssues);

    return {
      id,
      endpoint,
      functionFile,
      functionExists,
      testFiles: tests,
      documentedInContracts,
      status: entryIssues.length === 0 ? 'ok' : 'invalid',
      issues: entryIssues,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    version: config.version ?? null,
    contractsDoc,
    checkedEntries: normalizedEntries.length,
    entries: normalizedEntries,
    issues,
  };
};

export const formatServerlessSensitiveCoverageMarkdown = report => {
  const lines = [
    '# Serverless Sensitive Coverage',
    '',
    `Generated at: ${report.generatedAt}`,
    `Version: ${String(report.version ?? 'unknown')}`,
    `Contracts doc: \`${report.contractsDoc || 'missing'}\``,
    `Checked entries: ${report.checkedEntries}`,
    '',
    '| Id | Endpoint | Function file | Tests | Contracts doc | Status |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const entry of report.entries) {
    lines.push(
      `| ${entry.id} | \`${entry.endpoint}\` | \`${entry.functionFile}\` | ${
        entry.testFiles.length > 0
          ? entry.testFiles.map(test => `${test.exists ? 'ok' : 'missing'}:${test.file}`).join('<br/>')
          : '-'
      } | ${entry.documentedInContracts ? 'ok' : 'missing'} | ${entry.status} |`
    );
  }

  lines.push('', '## Issues', '');
  if (report.issues.length === 0) {
    lines.push('- none');
  } else {
    for (const issue of report.issues) {
      lines.push(`- ${issue}`);
    }
  }

  return lines.join('\n');
};
