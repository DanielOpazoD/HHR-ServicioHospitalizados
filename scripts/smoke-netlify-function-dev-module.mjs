#!/usr/bin/env node

import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';

const projectRoot = process.cwd();
const requireFromScript = createRequire(import.meta.url);
const aliasExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

const fail = message => {
  console.error(`[netlify-function-dev-smoke] ${message}`);
  process.exit(1);
};

const resolveTsconfigAliasPath = importPath => {
  const basePath = path.resolve(projectRoot, importPath.replace(/^@\//, 'src/'));
  if (fs.existsSync(basePath)) return basePath;

  for (const extension of aliasExtensions) {
    const candidate = `${basePath}${extension}`;
    if (fs.existsSync(candidate)) return candidate;
  }

  for (const extension of aliasExtensions) {
    const candidate = path.join(basePath, `index${extension}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return basePath;
};

const outputDir = path.join(os.tmpdir(), 'hhr-netlify-functions-dev-smoke');
fs.mkdirSync(outputDir, { recursive: true });
const outputFile = path.join(outputDir, `clinical-document-ai-import-${Date.now()}.cjs`);

await build({
  absWorkingDir: projectRoot,
  bundle: true,
  entryPoints: [path.resolve(projectRoot, 'netlify/functions/clinical-document-ai-import.ts')],
  format: 'cjs',
  outfile: outputFile,
  platform: 'node',
  target: 'node22',
  plugins: [
    {
      name: 'hhr-smoke-tsconfig-paths',
      setup(esbuild) {
        esbuild.onResolve({ filter: /^@\// }, args => ({
          path: resolveTsconfigAliasPath(args.path),
        }));
      },
    },
  ],
});

process.env.HHR_ALLOW_LOCAL_FUNCTION_ORIGINS = 'true';
process.env.AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'local-smoke-key';

const loadedModule = requireFromScript(outputFile);
if (typeof loadedModule.handler !== 'function') {
  fail('clinical-document-ai-import handler was not loaded');
}

const response = await loadedModule.handler({
  body: JSON.stringify({
    sourceText:
      'Informe de traslado con datos clinicos suficientes para validar el smoke local de Netlify Functions.',
  }),
  headers: {
    'content-type': 'application/json',
  },
  httpMethod: 'POST',
  isBase64Encoded: false,
  path: '/.netlify/functions/clinical-document-ai-import',
  rawQuery: '',
});

if (response.statusCode !== 401) {
  fail(`expected unauthorized smoke response, received ${response.statusCode}: ${response.body}`);
}

console.log('[netlify-function-dev-smoke] OK clinical-document-ai-import loads locally');
