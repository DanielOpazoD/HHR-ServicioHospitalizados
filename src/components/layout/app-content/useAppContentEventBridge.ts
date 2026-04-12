import { useEffect } from 'react';
import type { ModuleType } from '@/constants/navigationConfig';

type ShiftType = 'day' | 'night';

interface UseAppContentEventBridgeParams {
  setCurrentModule: (module: ModuleType) => void;
  setSelectedShift: (shift: ShiftType) => void;
}

const isShiftType = (value: unknown): value is ShiftType => value === 'day' || value === 'night';

const useWindowEvent = <T>(
  eventName: string,
  handleDetail: (detail: T | undefined) => void,
  dependency: unknown
) => {
  useEffect(() => {
    const handler = (event: Event) => {
      handleDetail((event as CustomEvent<T | undefined>).detail);
    };

    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [dependency, eventName, handleDetail]);
};

export const useAppContentEventBridge = ({
  setCurrentModule,
  setSelectedShift,
}: UseAppContentEventBridgeParams): void => {
  useWindowEvent<ModuleType>(
    'navigate-module',
    detail => {
      if (detail) {
        setCurrentModule(detail);
      }
    },
    setCurrentModule
  );

  useWindowEvent<ShiftType>(
    'set-shift',
    detail => {
      if (isShiftType(detail)) {
        setSelectedShift(detail);
      }
    },
    setSelectedShift
  );
};
