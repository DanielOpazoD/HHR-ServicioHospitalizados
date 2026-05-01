import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readReportScript = () =>
  fs.readFileSync(path.join(process.cwd(), 'scripts/report-flow-performance-budget.mjs'), 'utf8');

describe('flow performance budget report script', () => {
  it('prints the concrete json and markdown artifact paths', () => {
    const script = readReportScript();

    expect(script).toContain('${FLOW_SUMMARY_JSON_PATH}');
    expect(script).toContain('${FLOW_MD_REPORT_PATH}');
    expect(script).not.toContain('flow-performance-budget-summary.json and .md');
  });
});
