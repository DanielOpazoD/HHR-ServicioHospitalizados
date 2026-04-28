import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import type { NetlifyEventLike } from '../../netlify/functions/lib/http';

export interface NetlifyFunctionDevEntry {
  route: string;
  modulePath: string;
}

interface NetlifyFunctionResponse {
  statusCode: number;
  headers?: Record<string, string | number | readonly string[] | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
}

interface NetlifyFunctionModule {
  handler?: (event: NetlifyEventLike) => Promise<NetlifyFunctionResponse>;
}

interface NetlifyFunctionDevServerLike {
  ssrFixStacktrace?: (error: Error) => void;
}

type NetlifyFunctionDevModuleLoader = (modulePath: string) => Promise<NetlifyFunctionModule>;

export const DEFAULT_NETLIFY_FUNCTION_DEV_ENTRIES: NetlifyFunctionDevEntry[] = [
  {
    route: '/.netlify/functions/clinical-document-ai-import',
    modulePath: '/netlify/functions/clinical-document-ai-import.ts',
  },
];

const readRequestBody = async (req: IncomingMessage): Promise<string | null> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  if (chunks.length === 0) {
    return null;
  }

  return Buffer.concat(chunks).toString('utf8');
};

const normalizeHeaders = (headers: IncomingMessage['headers']): Record<string, string> => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalized[key] = value;
    } else if (Array.isArray(value)) {
      normalized[key] = value.join(', ');
    }
  }
  return normalized;
};

const resolveFunctionEntry = (
  requestUrl: string | undefined,
  entries: NetlifyFunctionDevEntry[]
): { entry: NetlifyFunctionDevEntry; url: URL } | null => {
  const url = new URL(requestUrl || '/', 'http://localhost');
  const entry = entries.find(candidate => url.pathname === candidate.route);
  return entry ? { entry, url } : null;
};

const writeFunctionResponse = (res: ServerResponse, response: NetlifyFunctionResponse): void => {
  res.statusCode = response.statusCode;
  for (const [key, value] of Object.entries(response.headers ?? {})) {
    if (typeof value !== 'undefined') {
      res.setHeader(key, value);
    }
  }

  const body = response.body ?? '';
  res.end(response.isBase64Encoded ? Buffer.from(body, 'base64') : body);
};

let buildSequence = 0;
const requireFromConfig = createRequire(import.meta.url);

export const loadNetlifyFunctionDevModule = async (
  modulePath: string
): Promise<NetlifyFunctionModule> => {
  const projectRoot = process.cwd();
  const absoluteEntry = path.resolve(projectRoot, modulePath.replace(/^\//, ''));
  const outputDir = path.join(os.tmpdir(), 'hhr-netlify-functions-dev');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(
    outputDir,
    `${path.basename(modulePath, '.ts')}-${Date.now()}-${buildSequence++}.cjs`
  );

  const { build: buildWithEsbuild } = await import('esbuild');

  await buildWithEsbuild({
    absWorkingDir: projectRoot,
    bundle: true,
    entryPoints: [absoluteEntry],
    format: 'cjs',
    outfile: outputFile,
    platform: 'node',
    sourcemap: 'inline',
    target: 'node22',
    plugins: [
      {
        name: 'hhr-tsconfig-paths',
        setup(build) {
          build.onResolve({ filter: /^@\// }, args => ({
            path: path.resolve(projectRoot, args.path.replace(/^@\//, 'src/')),
          }));
        },
      },
    ],
  });

  return requireFromConfig(outputFile) as NetlifyFunctionModule;
};

export const handleNetlifyFunctionDevRequest = async ({
  entries = DEFAULT_NETLIFY_FUNCTION_DEV_ENTRIES,
  loadModule = loadNetlifyFunctionDevModule,
  next,
  req,
  res,
  server,
}: {
  entries?: NetlifyFunctionDevEntry[];
  loadModule?: NetlifyFunctionDevModuleLoader;
  next: (error?: unknown) => void;
  req: IncomingMessage;
  res: ServerResponse;
  server: NetlifyFunctionDevServerLike;
}): Promise<void> => {
  const resolved = resolveFunctionEntry(req.url, entries);
  if (!resolved) {
    next();
    return;
  }

  try {
    const loadedModule = await loadModule(resolved.entry.modulePath);
    if (typeof loadedModule.handler !== 'function') {
      throw new Error(`Netlify function handler not found: ${resolved.entry.modulePath}`);
    }

    const response = await loadedModule.handler({
      body: await readRequestBody(req),
      headers: normalizeHeaders(req.headers),
      httpMethod: req.method || 'GET',
      isBase64Encoded: false,
      path: resolved.url.pathname,
      rawQuery: resolved.url.search.startsWith('?') ? resolved.url.search.slice(1) : '',
    });

    writeFunctionResponse(res, response);
  } catch (error) {
    if (error instanceof Error) {
      server.ssrFixStacktrace?.(error);
    }
    next(error);
  }
};

export const netlifyFunctionDevServerPlugin = (
  entries: NetlifyFunctionDevEntry[] = DEFAULT_NETLIFY_FUNCTION_DEV_ENTRIES
): Plugin => ({
  name: 'hhr-netlify-function-dev-server',
  apply: 'serve',
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      void handleNetlifyFunctionDevRequest({ entries, next, req, res, server });
    });
  },
});
