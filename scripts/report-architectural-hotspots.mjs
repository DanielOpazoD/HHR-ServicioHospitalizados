#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');
const REPORTS_DIR = path.join(ROOT, 'reports');
const JSON_OUTPUT = path.join(REPORTS_DIR, 'architectural-hotspots.json');
const MD_OUTPUT = path.join(REPORTS_DIR, 'architectural-hotspots.md');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IMPORT_REGEX =
  /(?:^|\n)\s*import(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']|(?:^|\n)\s*export\s+[^;\n]*\sfrom\s*["']([^"']+)["']/g;

const CRITICALITY_BY_CONTEXT = {
  auth: 'critical',
  services: 'high',
  application: 'high',
  features: 'high',
  context: 'medium',
  hooks: 'medium',
  components: 'medium',
  domain: 'medium',
  shared: 'medium',
  schemas: 'medium',
  types: 'medium',
};

const toPosix = value => value.split(path.sep).join('/');

const walkFiles = dirPath => {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
};

const resolveImport = (importerFilePath, importPath) => {
  if (!importPath.startsWith('@/') && !importPath.startsWith('.')) return null;

  const basePath = importPath.startsWith('@/')
    ? path.join(SRC_ROOT, importPath.slice(2))
    : path.resolve(path.dirname(importerFilePath), importPath);

  const candidates = [];
  if (path.extname(basePath)) {
    candidates.push(basePath);
  } else {
    for (const extension of SOURCE_EXTENSIONS) {
      candidates.push(`${basePath}${extension}`);
      candidates.push(path.join(basePath, `index${extension}`));
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.normalize(candidate);
    }
  }

  return null;
};

const resolveCriticality = relativePath => {
  const zone = relativePath.replace(/^src\//, '').split('/')[0] || 'shared';
  return CRITICALITY_BY_CONTEXT[zone] || 'medium';
};

const criticalityWeight = criticality => {
  switch (criticality) {
    case 'critical':
      return 5;
    case 'high':
      return 4;
    case 'medium':
      return 3;
    default:
      return 2;
  }
};

const countLines = content => content.split('\n').length;

const resolveHotspotRole = (relativePath, content, lines) => {
  const meaningfulLines = content
    .split('\n')
    .map(line => line.trim())
    .filter(
      line => line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')
    );

  const isBarrel =
    lines <= 25 &&
    meaningfulLines.length > 0 &&
    meaningfulLines.every(line => line.startsWith('export '));
  if (isBarrel) return 'barrel';

  if (
    relativePath.includes('/contracts/') ||
    relativePath.includes('/types/') ||
    /(?:Contracts|Types)\.(?:ts|tsx)$/.test(relativePath) ||
    relativePath.endsWith('/domain/entities.ts')
  ) {
    return 'contract';
  }

  if (relativePath.includes('/context/') || relativePath.includes('/hooks/')) {
    return 'orchestrator';
  }

  return 'implementation';
};

const resolveRecommendedAction = ({ churn, inboundImports, lines, role }) => {
  if (role === 'barrel') return 'watch-only';
  if (role === 'contract' && churn <= 3) return 'protect-api';
  if (lines >= 250 || churn >= 20) return 'reduce-responsibility';
  if (inboundImports >= 30) return 'protect-boundary';
  return 'watch';
};

const sourceFiles = walkFiles(SRC_ROOT).filter(filePath => {
  const relative = toPosix(path.relative(ROOT, filePath));
  const extension = path.extname(filePath);
  return (
    SOURCE_EXTENSIONS.has(extension) &&
    !relative.includes('/tests/') &&
    !relative.includes('.test.') &&
    !relative.includes('.spec.') &&
    !relative.endsWith('.d.ts')
  );
});

const churnMap = new Map();
try {
  const gitLogOutput = execSync('git log --name-only --pretty=format: -- src', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  gitLogOutput
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .forEach(relativePath => {
      churnMap.set(relativePath, (churnMap.get(relativePath) || 0) + 1);
    });
} catch {
  // Keep empty churn map when git metadata is unavailable.
}

const inboundImportsMap = new Map(
  sourceFiles.map(filePath => [toPosix(path.relative(ROOT, filePath)), 0])
);

for (const filePath of sourceFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  IMPORT_REGEX.lastIndex = 0;
  let match;

  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    if (!importPath) continue;

    const resolved = resolveImport(filePath, importPath);
    if (!resolved) continue;
    const relative = toPosix(path.relative(ROOT, resolved));
    if (!inboundImportsMap.has(relative)) continue;
    inboundImportsMap.set(relative, (inboundImportsMap.get(relative) || 0) + 1);
  }
}

const hotspots = sourceFiles
  .map(filePath => {
    const relative = toPosix(path.relative(ROOT, filePath));
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = countLines(content);
    const role = resolveHotspotRole(relative, content, lines);
    const churn = churnMap.get(relative) || 0;
    const inboundImports = inboundImportsMap.get(relative) || 0;
    const criticality = resolveCriticality(relative);
    const score = churn * 2 + inboundImports * 3 + criticalityWeight(criticality) * 5;
    const recommendedAction = resolveRecommendedAction({ churn, inboundImports, lines, role });
    return {
      file: relative,
      lines,
      churn,
      inboundImports,
      criticality,
      role,
      recommendedAction,
      score,
    };
  })
  .sort((left, right) => right.score - left.score)
  .slice(0, 30);

const payload = {
  generatedAt: new Date().toISOString(),
  hotspots,
  interpretation: {
    scoreFormula: 'churn*2 + inboundImports*3 + criticalityWeight*5',
    guidance:
      'Priorizar archivos con score alto y accion reduce-responsibility/protect-boundary. Contratos estables y barrels pequenos se protegen, no se refactorizan solo por tener muchos imports.',
  },
};

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const markdown = `# Architectural Hotspots

- Generated: ${payload.generatedAt}
- Ranking formula: \`churn*2 + inboundImports*3 + criticalityWeight*5\`

## Interpretation

- Score alto = alto costo de cambio probable.
- Priorizar score alto con acción \`reduce-responsibility\` o \`protect-boundary\`.
- Contratos estables y barrels pequeños son superficies sanas: proteger API antes que fragmentar.
- Cruzar este reporte con compatibilidad legacy y cobertura crítica antes de priorizar trabajo.

## Top Hotspots

| File | Lines | Churn | Inbound imports | Criticality | Role | Action | Score |
| --- | ---: | ---: | ---: | --- | --- | --- | ---: |
${hotspots
  .map(
    hotspot =>
      `| \`${hotspot.file}\` | ${hotspot.lines} | ${hotspot.churn} | ${hotspot.inboundImports} | ${hotspot.criticality} | ${hotspot.role} | ${hotspot.recommendedAction} | ${hotspot.score} |`
  )
  .join('\n')}
`;

fs.writeFileSync(MD_OUTPUT, `${markdown}\n`, 'utf8');

console.log(
  '[architectural-hotspots] Report generated at reports/architectural-hotspots.{md,json}'
);
