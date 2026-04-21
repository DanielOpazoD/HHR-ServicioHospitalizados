import { describe, expect, it } from 'vitest';
import {
  hasMeaningfulWorktreeChanges,
  isIgnorableGeneratedReportStatusLine,
} from '../../../scripts/gitReportState.mjs';

describe('gitReportState', () => {
  it('ignores generated legacy bridge governance report artifacts', () => {
    expect(isIgnorableGeneratedReportStatusLine(' M reports/legacy-bridge-governance.json')).toBe(
      true
    );
    expect(isIgnorableGeneratedReportStatusLine(' M reports/legacy-bridge-governance.md')).toBe(
      true
    );
  });

  it('keeps non-generated paths as meaningful worktree changes', () => {
    expect(hasMeaningfulWorktreeChanges(' M src/app.ts\n')).toBe(true);
  });

  it('treats worktree output with only generated legacy bridge reports as clean for scorecards', () => {
    expect(
      hasMeaningfulWorktreeChanges(
        [' M reports/legacy-bridge-governance.json', ' M reports/legacy-bridge-governance.md'].join(
          '\n'
        )
      )
    ).toBe(false);
  });
});
