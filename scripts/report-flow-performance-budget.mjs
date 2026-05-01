#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildFlowPerformanceReport,
  FLOW_MD_REPORT_PATH,
  FLOW_REPORT_PATH,
  FLOW_SUMMARY_JSON_PATH,
  formatFlowPerformanceMarkdown,
} from './flowPerformanceBudgetSupport.mjs';

const root = process.cwd();
const report = buildFlowPerformanceReport(root);

if (!report) {
  console.error('[flow-performance-budget] Missing reports/e2e/flow-performance-budget.json');
  process.exit(1);
}

const sourceReportPath = path.join(root, FLOW_REPORT_PATH);
if (!fs.existsSync(sourceReportPath)) {
  console.error('[flow-performance-budget] Missing raw flow report.');
  process.exit(1);
}

const jsonOutputPath = path.join(root, FLOW_SUMMARY_JSON_PATH);
const mdOutputPath = path.join(root, FLOW_MD_REPORT_PATH);

fs.mkdirSync(path.dirname(jsonOutputPath), { recursive: true });
fs.writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(mdOutputPath, `${formatFlowPerformanceMarkdown(report)}\n`, 'utf8');

console.log(
  `[flow-performance-budget] Report generated at ${FLOW_SUMMARY_JSON_PATH} and ${FLOW_MD_REPORT_PATH}`
);
