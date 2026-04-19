import { useCallback } from 'react';
import { executeActivateEmptyBedController } from '@/features/census/controllers/censusEmptyBedActivationController';

interface UseEmptyBedActivationResult {
  activateEmptyBed: (bedId: string) => void;
}

export const useEmptyBedActivation = (): UseEmptyBedActivationResult => {
  const activateEmptyBed = useCallback((bedId: string) => {
    executeActivateEmptyBedController({
      bedId,
      runtime: {
        requestFrame: callback => {
          const raf = typeof window !== 'undefined' ? window.requestAnimationFrame : undefined;
          if (!raf) {
            callback();
            return;
          }
          raf(callback);
        },
        querySelector: selector => document.querySelector(selector),
      },
    });
  }, []);

  return { activateEmptyBed };
};
