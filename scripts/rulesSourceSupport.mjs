#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

export const RULE_ASSETS = {
  firestore: {
    output: 'firestore.rules',
    sources: [
      'rules/firestore/00-auth-and-role-helpers.rules',
      'rules/firestore/10-specialist-and-clinical-document-helpers.rules',
      'rules/firestore/20-access-and-payload-helpers.rules',
      'rules/firestore/30-daily-record-write-helpers.rules',
      'rules/firestore/40-hospitals.rules',
      'rules/firestore/50-global-rules.rules',
    ],
  },
  storage: {
    output: 'storage.rules',
    sources: [
      'rules/storage/00-helper-functions.rules',
      'rules/storage/10-storage-paths.rules',
    ],
  },
};

const ensureTrailingNewline = content => (content.endsWith('\n') ? content : `${content}\n`);

export const buildRuleAssetContent = (root, assetName) => {
  const asset = RULE_ASSETS[assetName];
  if (!asset) {
    throw new Error(`Unknown rules asset: ${assetName}`);
  }

  return asset.sources
    .map(relativePath => {
      const absolutePath = path.join(root, relativePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Missing rules source fragment: ${relativePath}`);
      }

      return fs.readFileSync(absolutePath, 'utf8');
    })
    .join('');
};

export const writeRuleAssets = root => {
  for (const [assetName, asset] of Object.entries(RULE_ASSETS)) {
    const content = ensureTrailingNewline(buildRuleAssetContent(root, assetName));
    fs.writeFileSync(path.join(root, asset.output), content, 'utf8');
  }
};

export const getRuleAssetDrift = root =>
  Object.entries(RULE_ASSETS).flatMap(([assetName, asset]) => {
    const expected = ensureTrailingNewline(buildRuleAssetContent(root, assetName));
    const outputPath = path.join(root, asset.output);
    const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;

    return actual === expected
      ? []
      : [
          {
            assetName,
            output: asset.output,
            sources: asset.sources,
          },
        ];
  });
