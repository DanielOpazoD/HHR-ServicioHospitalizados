import { describe, expect, it, vi } from 'vitest';
import { preloadCensusComponentsChunk, preloadCensusRegisterContentChunk } from '@/features/census';

describe('census public preload API', () => {
  it('exposes a public preload for heavy census components', async () => {
    const loadCensusComponents = vi.fn().mockResolvedValue({});

    await preloadCensusComponentsChunk(loadCensusComponents);

    expect(loadCensusComponents).toHaveBeenCalledTimes(1);
  });

  it('exposes a public preload for register content without external deep imports', async () => {
    const loadCensusRegisterContent = vi.fn().mockResolvedValue({});

    await preloadCensusRegisterContentChunk(loadCensusRegisterContent);

    expect(loadCensusRegisterContent).toHaveBeenCalledTimes(1);
  });
});
