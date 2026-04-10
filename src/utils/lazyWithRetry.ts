/**
 * Lazy component loader with automatic recovery from chunk load errors.
 *
 * After a deploy on Netlify, old chunk filenames may no longer exist.
 * This wrapper detects chunk load failures and reloads the page once
 * to fetch the updated bundle. A session counter prevents infinite reload loops.
 */

import { lazy, type ComponentType } from 'react';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntime';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryService';

const RELOAD_KEY = 'hhr_chunk_reload_count';
const MAX_RELOADS = 2;

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('loading chunk') ||
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch') ||
    error.name === 'ChunkLoadError'
  );
}

// ComponentType<any> preserves the wrapped lazy component props; unknown erases them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (isChunkLoadError(error)) {
        const reloadCount = Number(sessionStorage.getItem(RELOAD_KEY) ?? '0');

        recordOperationalTelemetry({
          category: 'integration',
          operation: 'chunk_load_recovery',
          status: reloadCount < MAX_RELOADS ? 'degraded' : 'failed',
          runtimeState: 'recoverable',
          issues: [
            `Chunk load failed (attempt ${reloadCount + 1}/${MAX_RELOADS}): ${error instanceof Error ? error.message : String(error)}`,
          ],
        });

        if (reloadCount < MAX_RELOADS) {
          sessionStorage.setItem(RELOAD_KEY, String(reloadCount + 1));
          defaultBrowserWindowRuntime.reload();
          // Never resolves — page reloads before this returns
          return new Promise<never>(() => {});
        }

        // Budget exhausted — clear counter and let the error propagate to the error boundary
        sessionStorage.removeItem(RELOAD_KEY);
      }
      throw error;
    }
  });
}
