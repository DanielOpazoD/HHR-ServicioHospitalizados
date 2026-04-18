import { afterEach, describe, expect, it, vi } from 'vitest';

describe('invokeWithTelemetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('firebase/firestore');
  });

  it('skips telemetry sink writes when firestore mocks omit addDoc', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    vi.doMock('firebase/firestore', () => ({
      collection: vi.fn(() => ({ path: 'hospitals/test/functionsTelemetry' })),
    }));

    const { invokeWithTelemetry } = await import('../../../netlify/functions/lib/observability');

    await expect(
      invokeWithTelemetry({
        service: 'syslab',
        operation: 'search',
        timeoutMs: 50,
        db: {} as never,
        hospitalId: 'test',
        fn: async () => 'ok',
      })
    ).resolves.toBe('ok');

    expect(stdoutWrite).toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
