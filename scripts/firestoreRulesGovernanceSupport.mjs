import fs from 'node:fs';
import path from 'node:path';
import { RULE_ASSETS } from './rulesSourceSupport.mjs';

const CONFIG_PATH = path.join('scripts', 'config', 'firestore-rules-governance.json');
const OWNERSHIP_PATH = path.join('scripts', 'config', 'technical-ownership-map.json');
const VALID_RISKS = new Set(['low', 'medium', 'high', 'critical']);

const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const countSourceLines = content => {
  const normalized = content.replace(/\r\n/g, '\n');
  const withoutFinalNewline = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
  return withoutFinalNewline.length === 0 ? 0 : withoutFinalNewline.split('\n').length;
};

const defaultCountLines = (root, file) => {
  const absolutePath = path.join(root, file);
  if (!fs.existsSync(absolutePath)) {
    return 0;
  }
  return countSourceLines(fs.readFileSync(absolutePath, 'utf8'));
};

const readOwnershipAreaIds = root => {
  const ownership = readJson(path.join(root, OWNERSHIP_PATH));
  return new Set(
    Array.isArray(ownership.areas)
      ? ownership.areas.map(area => area?.id).filter(id => typeof id === 'string' && id.trim())
      : []
  );
};

const resolveConfig = (root, config) => config ?? readJson(path.join(root, CONFIG_PATH));

const resolveOwnershipAreaIds = (root, ownershipAreaIds) =>
  ownershipAreaIds ?? readOwnershipAreaIds(root);

export const buildFirestoreRulesGovernanceReport = (root, options = {}) => {
  const config = resolveConfig(root, options.config);
  const firestoreSources = options.firestoreSources ?? RULE_ASSETS.firestore.sources;
  const ownershipAreaIds = resolveOwnershipAreaIds(root, options.ownershipAreaIds);
  const countLines = options.countLines ?? (file => defaultCountLines(root, file));
  const fileExists = options.fileExists ?? (file => fs.existsSync(path.join(root, file)));
  const issues = [];

  if (config.version !== 1) {
    issues.push(`Expected version 1, received ${String(config.version || 'unknown')}.`);
  }

  const generatedConfig = config.generatedRules ?? {};
  const generatedFile =
    typeof generatedConfig.file === 'string' && generatedConfig.file.trim()
      ? generatedConfig.file.trim()
      : RULE_ASSETS.firestore.output;
  const generatedLines = countLines(generatedFile);
  const maxGeneratedLines =
    typeof generatedConfig.maxLines === 'number' ? generatedConfig.maxLines : null;
  const generatedOwnerAreaId =
    typeof generatedConfig.ownerAreaId === 'string' ? generatedConfig.ownerAreaId.trim() : '';

  if (!fileExists(generatedFile)) {
    issues.push(`${generatedFile} is missing.`);
  }

  if (typeof maxGeneratedLines !== 'number') {
    issues.push(`${generatedFile} is missing a governed maxLines budget.`);
  } else if (generatedLines > maxGeneratedLines) {
    issues.push(
      `${generatedFile} has ${generatedLines} lines; keep generated rules within the governed ${maxGeneratedLines} line budget.`
    );
  }

  if (!generatedOwnerAreaId) {
    issues.push(`${generatedFile} is missing ownerAreaId.`);
  } else if (!ownershipAreaIds.has(generatedOwnerAreaId)) {
    issues.push(`${generatedFile} references unknown ownerAreaId ${generatedOwnerAreaId}.`);
  }

  const configuredFragments = Array.isArray(config.fragments) ? config.fragments : [];
  const fragmentByPath = new Map(
    configuredFragments
      .filter(fragment => typeof fragment?.path === 'string' && fragment.path.trim())
      .map(fragment => [fragment.path.trim(), fragment])
  );

  const duplicateFragmentPaths = configuredFragments
    .map(fragment => (typeof fragment?.path === 'string' ? fragment.path.trim() : ''))
    .filter((fragmentPath, index, all) => fragmentPath && all.indexOf(fragmentPath) !== index);

  for (const duplicatePath of [...new Set(duplicateFragmentPaths)]) {
    issues.push(`${duplicatePath} has duplicate ownership entries.`);
  }

  const fragmentReports = firestoreSources.map(sourcePath => {
    const fragment = fragmentByPath.get(sourcePath);
    const ownerAreaId =
      typeof fragment?.ownerAreaId === 'string' ? fragment.ownerAreaId.trim() : '';
    const risk = typeof fragment?.risk === 'string' ? fragment.risk.trim() : '';
    const reason = typeof fragment?.reason === 'string' ? fragment.reason.trim() : '';
    const lines = countLines(sourcePath);

    if (!fileExists(sourcePath)) {
      issues.push(`${sourcePath} is missing.`);
    }

    if (!fragment) {
      issues.push(`${sourcePath} is missing ownership in ${CONFIG_PATH}.`);
    } else {
      if (!ownerAreaId) {
        issues.push(`${sourcePath} is missing ownerAreaId.`);
      } else if (!ownershipAreaIds.has(ownerAreaId)) {
        issues.push(`${sourcePath} references unknown ownerAreaId ${ownerAreaId}.`);
      }

      if (!VALID_RISKS.has(risk)) {
        issues.push(`${sourcePath} has invalid risk ${risk || 'unknown'}.`);
      }

      if (!reason) {
        issues.push(`${sourcePath} is missing a governance reason.`);
      }
    }

    return {
      path: sourcePath,
      lines,
      ownerAreaId: ownerAreaId || null,
      risk: risk || null,
      reason: reason || null,
    };
  });

  for (const configuredPath of fragmentByPath.keys()) {
    if (!firestoreSources.includes(configuredPath)) {
      issues.push(`${configuredPath} is not part of the generated Firestore rules source list.`);
    }
  }

  return {
    generatedRules: {
      file: generatedFile,
      lines: generatedLines,
      maxLines: maxGeneratedLines,
      remainingLines:
        typeof maxGeneratedLines === 'number' ? maxGeneratedLines - generatedLines : null,
      ownerAreaId: generatedOwnerAreaId || null,
      runbook:
        typeof generatedConfig.runbook === 'string' && generatedConfig.runbook.trim()
          ? generatedConfig.runbook.trim()
          : null,
    },
    fragments: fragmentReports,
    issues,
  };
};

