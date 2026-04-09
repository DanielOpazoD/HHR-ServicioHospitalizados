import { useCallback, useEffect, useRef } from 'react';
import { createScopedLogger } from '@/services/utils/loggerScope';

const singleFlightLogger = createScopedLogger('SingleFlightAsyncCommand');

interface SingleFlightCommandRunner {
  runSingleFlight: (task: () => Promise<void>) => boolean;
  isMounted: () => boolean;
}

export const useSingleFlightAsyncCommand = (): SingleFlightCommandRunner => {
  const isMountedRef = useRef(true);
  const isInFlightRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      isInFlightRef.current = false;
    };
  }, []);

  const isMounted = useCallback(() => isMountedRef.current, []);

  const runSingleFlight = useCallback((task: () => Promise<void>): boolean => {
    if (isInFlightRef.current) {
      return false;
    }

    isInFlightRef.current = true;
    let taskPromise: Promise<void>;

    try {
      taskPromise = task();
    } catch {
      isInFlightRef.current = false;
      return true;
    }

    void taskPromise
      .catch((error: unknown) => {
        singleFlightLogger.error('Single-flight async command failed', error);
      })
      .finally(() => {
        isInFlightRef.current = false;
      });

    return true;
  }, []);

  return {
    runSingleFlight,
    isMounted,
  };
};
