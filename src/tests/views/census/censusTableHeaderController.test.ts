import { describe, expect, it } from 'vitest';

import { buildCensusHeaderCellModels } from '@/features/census/controllers/censusTableHeaderController';

describe('censusTableHeaderController', () => {
  it('keeps all census columns in default access profile', () => {
    const cells = buildCensusHeaderCellModels(undefined, 'default');
    const keys = cells.map(cell => cell.key);

    expect(keys).toContain('status');
    expect(keys).toContain('dmi');
    expect(keys).toContain('cqx');
    expect(keys).toContain('upc');
  });

  it('hides specialist-restricted census columns', () => {
    const cells = buildCensusHeaderCellModels(undefined, 'specialist');
    const keys = cells.map(cell => cell.key);

    expect(keys).not.toContain('status');
    expect(keys).not.toContain('dmi');
    expect(keys).not.toContain('cqx');
    expect(keys).not.toContain('upc');
    expect(keys).toContain('diagnosis');
    expect(keys).toContain('specialty');
  });
});
