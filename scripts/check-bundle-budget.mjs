#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const assetsDir = path.join(distDir, 'assets');
const indexHtmlPath = path.join(distDir, 'index.html');
const configPath = path.join(rootDir, 'scripts', 'config', 'bundle-budget.json');

const fail = message => {
  console.error(`[bundle-budget] ${message}`);
  process.exit(1);
};

const toKb = value => `${(value / 1024).toFixed(1)} KB`;
const toPct = (value, max) => `${((value / max) * 100).toFixed(1)}%`;
const nearLimitThresholdRatio = 0.9;

if (!fs.existsSync(configPath)) {
  fail(`Missing config file: ${configPath}`);
}

if (!fs.existsSync(indexHtmlPath) || !fs.existsSync(assetsDir)) {
  fail('dist assets not found. Run "npm run build" before checking bundle budgets.');
}

let parsedConfig;
try {
  parsedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  fail(`Invalid JSON in config: ${error instanceof Error ? error.message : String(error)}`);
}

const entryMaxBytes = Number(parsedConfig?.entryMaxBytes || 0);
const chunkMaxBytes = Number(parsedConfig?.chunkMaxBytes || 0);
const startupChunkBudgets = Array.isArray(parsedConfig?.startupChunkBudgets)
  ? parsedConfig.startupChunkBudgets
  : [];
const chunkPatternBudgets = Array.isArray(parsedConfig?.chunkPatternBudgets)
  ? parsedConfig.chunkPatternBudgets
  : [];

if (!entryMaxBytes || !chunkMaxBytes) {
  fail('Config must include positive entryMaxBytes and chunkMaxBytes');
}

const html = fs.readFileSync(indexHtmlPath, 'utf8');
const entryScriptMatches = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)];

if (entryScriptMatches.length === 0) {
  fail('No entry script found in dist/index.html');
}

const entryFiles = entryScriptMatches.map(match => {
  const sourcePath = match[1];
  const normalized = sourcePath.startsWith('/') ? sourcePath.slice(1) : sourcePath;
  const fullPath = path.join(distDir, normalized);
  if (!fs.existsSync(fullPath)) {
    fail(`Entry script declared in HTML not found on disk: ${normalized}`);
  }
  return {
    name: path.basename(fullPath),
    filePath: fullPath,
    size: fs.statSync(fullPath).size,
  };
});

const jsAssets = fs
  .readdirSync(assetsDir, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
  .map(entry => {
    const filePath = path.join(assetsDir, entry.name);
    return {
      name: entry.name,
      filePath,
      size: fs.statSync(filePath).size,
    };
  });

const violations = [];
const nearLimitWarnings = [];

for (const entryFile of entryFiles) {
  if (entryFile.size > entryMaxBytes) {
    violations.push(
      `Entry "${entryFile.name}" is ${toKb(entryFile.size)} (limit ${toKb(entryMaxBytes)})`
    );
  } else if (entryFile.size / entryMaxBytes >= nearLimitThresholdRatio) {
    nearLimitWarnings.push(
      `Entry "${entryFile.name}" is near limit: ${toKb(entryFile.size)} (${toPct(entryFile.size, entryMaxBytes)} of ${toKb(entryMaxBytes)})`
    );
  }
}

for (const asset of jsAssets) {
  if (asset.size > chunkMaxBytes) {
    violations.push(
      `Chunk "${asset.name}" is ${toKb(asset.size)} (global chunk limit ${toKb(chunkMaxBytes)})`
    );
  } else if (asset.size / chunkMaxBytes >= nearLimitThresholdRatio) {
    nearLimitWarnings.push(
      `Chunk "${asset.name}" is near global limit: ${toKb(asset.size)} (${toPct(asset.size, chunkMaxBytes)} of ${toKb(chunkMaxBytes)})`
    );
  }
}

for (const patternBudget of chunkPatternBudgets) {
  const pattern = typeof patternBudget?.pattern === 'string' ? patternBudget.pattern : '';
  const maxBytes = Number(patternBudget?.maxBytes || 0);
  if (!pattern || !maxBytes) continue;

  let regex;
  try {
    regex = new RegExp(pattern);
  } catch (error) {
    fail(
      `Invalid regex "${pattern}" in config: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  for (const asset of jsAssets.filter(candidate => regex.test(candidate.name))) {
    if (asset.size > maxBytes) {
      violations.push(
        `Chunk "${asset.name}" is ${toKb(asset.size)} (pattern ${pattern} limit ${toKb(maxBytes)})`
      );
    } else if (asset.size / maxBytes >= nearLimitThresholdRatio) {
      nearLimitWarnings.push(
        `Chunk "${asset.name}" is near pattern limit: ${toKb(asset.size)} (${toPct(asset.size, maxBytes)} of ${toKb(maxBytes)}) [pattern ${pattern}]`
      );
    }
  }
}

for (const startupBudget of startupChunkBudgets) {
  const label = typeof startupBudget?.label === 'string' ? startupBudget.label : 'startup-chunk';
  const source = startupBudget?.source === 'entry' ? 'entry' : 'pattern';
  const pattern = typeof startupBudget?.pattern === 'string' ? startupBudget.pattern : '';
  const maxBytes = Number(startupBudget?.maxBytes || 0);
  const severity = startupBudget?.severity === 'warn' ? 'warn' : 'error';

  if ((!pattern && source !== 'entry') || !maxBytes) {
    fail(`Invalid startup chunk budget for ${label}`);
  }

  let candidateAssets;
  if (source === 'entry') {
    candidateAssets = entryFiles;
  } else {
    let regex;
    try {
      regex = new RegExp(pattern);
    } catch (error) {
      fail(
        `Invalid startup chunk regex "${pattern}" for ${label}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    candidateAssets = jsAssets.filter(candidate => regex.test(candidate.name));
  }

  for (const asset of candidateAssets) {
    if (asset.size > maxBytes) {
      const message = `Startup chunk budget (${label}): "${asset.name}" is ${toKb(asset.size)} (limit ${toKb(maxBytes)})`;
      if (severity === 'error') {
        violations.push(message);
      } else {
        nearLimitWarnings.push(message);
      }
    } else if (asset.size / maxBytes >= nearLimitThresholdRatio) {
      nearLimitWarnings.push(
        `Startup chunk (${label}) is near limit: "${asset.name}" is ${toKb(asset.size)} (${toPct(asset.size, maxBytes)} of ${toKb(maxBytes)})`
      );
    }
  }
}

if (violations.length > 0) {
  console.error('[bundle-budget] Validation failed:');
  violations.forEach(violation => console.error(`- ${violation}`));
  process.exit(1);
}

const largestChunks = [...jsAssets].sort((a, b) => b.size - a.size).slice(0, 5);
console.warn('[bundle-budget] OK');
console.warn(
  `[bundle-budget] Entry budget: ${toKb(entryMaxBytes)} | Chunk budget: ${toKb(chunkMaxBytes)}`
);
entryFiles.forEach(entryFile => {
  console.warn(`[bundle-budget] Entry asset: ${entryFile.name} (${toKb(entryFile.size)})`);
});
largestChunks.forEach(chunk => {
  console.warn(`[bundle-budget] Largest chunk: ${chunk.name} (${toKb(chunk.size)})`);
});
if (nearLimitWarnings.length > 0) {
  console.warn('[bundle-budget] Near-limit warnings:');
  nearLimitWarnings.forEach(warning => console.warn(`- ${warning}`));
}
