import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/**
 * Run a per-feature module-size check.
 *
 * The config file shape is `{ "files": { "<relativePath>": <maxLines> } }`.
 * Any listed file that is missing, or that exceeds its `maxLines` budget,
 * becomes a violation and the script exits with code 1.
 *
 * @param {object} options
 * @param {string} options.configFile  Relative path to the JSON budget file.
 * @param {string} options.label       Human-readable label for log output.
 */
export const runFeatureModuleSizeCheck = ({ configFile, label }) => {
  if (!configFile || !label) {
    throw new Error('runFeatureModuleSizeCheck requires `configFile` and `label`.');
  }

  const configPath = path.join(ROOT, configFile);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const violations = [];

  for (const [relativePath, maxLines] of Object.entries(config.files)) {
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) {
      violations.push(`${relativePath}: file missing`);
      continue;
    }

    const lineCount = fs.readFileSync(absolutePath, 'utf8').split('\n').length;
    if (lineCount > maxLines) {
      violations.push(`${relativePath}: ${lineCount} lines (limit ${maxLines})`);
    }
  }

  if (violations.length > 0) {
    console.error(`\n${label} module size violations:`);
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log(`${label} module size checks passed.`);
};
