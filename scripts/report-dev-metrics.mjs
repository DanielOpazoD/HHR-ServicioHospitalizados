import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const reportsDir = path.join(projectRoot, 'reports');
const outputPath = path.join(reportsDir, 'dev-metrics.json');
const testRoots = ['src/tests', 'e2e'];
const testPattern = /\b(?:it|test)\s*\(/g;

const countDeclaredTests = rootRelativePath => {
  const root = path.join(projectRoot, rootRelativePath);
  if (!fs.existsSync(root)) {
    return { files: 0, tests: 0 };
  }

  let files = 0;
  let tests = 0;

  const walk = currentPath => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        continue;
      }

      const content = fs.readFileSync(entryPath, 'utf8');
      const matchCount = content.match(testPattern)?.length ?? 0;
      if (matchCount > 0) {
        files += 1;
        tests += matchCount;
      }
    }
  };

  walk(root);
  return { files, tests };
};

const summary = testRoots.reduce(
  (acc, root) => {
    const metrics = countDeclaredTests(root);
    return {
      files: acc.files + metrics.files,
      tests: acc.tests + metrics.tests,
    };
  },
  { files: 0, tests: 0 }
);

fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: 'static-test-declaration-scan',
      roots: testRoots,
      declaredTestFiles: summary.files,
      declaredTests: summary.tests,
    },
    null,
    2
  ) + '\n',
  'utf8'
);

console.log(`[dev-metrics] Report generated at ${outputPath}`);
