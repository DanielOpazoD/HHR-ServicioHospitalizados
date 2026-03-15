import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDevMetrics } from '@/hooks/useDevMetrics';

describe('useDevMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should return default metrics when fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useDevMetrics());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics).not.toBeNull();
    // Since it used defaults (Statements: 66.94%), healthScore should be A for 100% tests
    expect(result.current.metrics?.healthScore).toBe('A');
  });

  it('should fetch and update metrics from artifact files', async () => {
    const mockResults = `\n> vitest run --reporter=json\n{\"numTotalTests\":100,\"numPassedTests\":90,\"numFailedTests\":10}`;
    const mockCoverage = JSON.stringify({
      total: {
        statements: { pct: 50 },
        functions: { pct: 40 },
        lines: { pct: 55 },
        branches: { pct: 30 },
      },
    });
    const mockQualityMetrics = JSON.stringify({
      generatedAt: '2026-03-14T05:27:38.671Z',
      tests: { testFileCount: 650 },
    });
    const mockDevMetrics = JSON.stringify({
      generatedAt: '2026-03-15T05:27:38.671Z',
      declaredTestFiles: 703,
      declaredTests: 3449,
    });

    vi.mocked(fetch).mockImplementation((url: RequestInfo | URL) => {
      if (url === '/test_results_current.json') {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(mockResults),
        } as unknown as Response);
      }
      if (url === '/coverage_current.json') {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(mockCoverage),
        } as unknown as Response);
      }
      if (url === '/reports/quality-metrics.json') {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(mockQualityMetrics),
        } as unknown as Response);
      }
      if (url === '/reports/dev-metrics.json') {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(mockDevMetrics),
        } as unknown as Response);
      }
      return Promise.resolve({ ok: false } as unknown as Response);
    });

    const { result } = renderHook(() => useDevMetrics());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics?.testStats.total).toBe(3449);
    expect(result.current.metrics?.testStats.passed).toBe(3449);
    expect(result.current.metrics?.testStats.successRate).toBe(100);
    expect(result.current.metrics?.coverage.statements).toBe(50);
    expect(result.current.metrics?.lastRun).toBe('2026-03-15T05:27:38.671Z');
    expect(result.current.metrics?.healthScore).toBe('B');
  });

  it('should fall back to quality metrics test count when vitest artifact is unavailable', async () => {
    vi.mocked(fetch).mockImplementation((url: RequestInfo | URL) => {
      if (url === '/reports/quality-metrics.json') {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                generatedAt: '2026-03-14T05:27:38.671Z',
                tests: { testFileCount: 650 },
              })
            ),
        } as unknown as Response);
      }
      if (url === '/reports/dev-metrics.json') {
        return Promise.resolve({ ok: false } as unknown as Response);
      }
      return Promise.resolve({ ok: false } as unknown as Response);
    });

    const { result } = renderHook(() => useDevMetrics());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics?.testStats.total).toBe(650);
    expect(result.current.metrics?.lastRun).toBe('2026-03-14T05:27:38.671Z');
  });

  it('should assign health score A for 100% tests and >60% coverage', async () => {
    vi.mocked(fetch).mockImplementation((_url: RequestInfo | URL) => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ numTotalTests: 100, numPassedTests: 100, numFailedTests: 0 }),
      } as unknown as Response);
    });

    const { result } = renderHook(() => useDevMetrics());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics?.healthScore).toBe('A');
  });

  it('prefers declared test count when the vitest artifact is clearly stale', async () => {
    vi.mocked(fetch).mockImplementation((url: RequestInfo | URL) => {
      if (url === '/test_results_current.json') {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              '\n> vitest run --reporter=json\n{"numTotalTests":1352,"numPassedTests":1336,"numFailedTests":3}'
            ),
        } as unknown as Response);
      }
      if (url === '/reports/dev-metrics.json') {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                generatedAt: '2026-03-15T05:27:38.671Z',
                declaredTests: 3449,
              })
            ),
        } as unknown as Response);
      }
      return Promise.resolve({ ok: false } as unknown as Response);
    });

    const { result } = renderHook(() => useDevMetrics());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.metrics?.testStats.total).toBe(3449);
    expect(result.current.metrics?.testStats.passed).toBe(3449);
  });
});
