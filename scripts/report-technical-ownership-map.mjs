#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'scripts', 'config', 'technical-ownership-map.json');
const REPORTS_DIR = path.join(ROOT, 'reports');
const JSON_OUTPUT = path.join(REPORTS_DIR, 'technical-ownership-map.json');
const MD_OUTPUT = path.join(REPORTS_DIR, 'technical-ownership-map.md');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const areas = Array.isArray(config.areas) ? config.areas : [];
const report = {
  generatedAt: new Date().toISOString(),
  version: config.version,
  areaCount: areas.length,
  areas,
};

const mdLines = [
  '# Technical Ownership Map',
  '',
  `Generated at: ${report.generatedAt}`,
  `Areas: ${report.areaCount}`,
  '',
  '| Area | Owner | Primary metric | Gates | Runbooks |',
  '| --- | --- | --- | --- | --- |',
];

for (const area of areas) {
  mdLines.push(
    `| ${area.id} | ${area.owner} | ${area.primaryMetric} | ${(area.gates || []).join(', ')} | ${(area.runbooks || []).join(', ')} |`
  );
}

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(MD_OUTPUT, `${mdLines.join('\n')}\n`, 'utf8');

console.log('[technical-ownership-map] Report generated at reports/technical-ownership-map.{md,json}');
