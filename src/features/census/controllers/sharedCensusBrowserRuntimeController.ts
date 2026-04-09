import {
  createCensusDialogRuntime,
  type CensusDialogRuntime,
} from '@/features/census/controllers/censusBrowserRuntimeAdapter';

export interface SharedCensusBrowserRuntime {
  alert: (message: string) => void;
  open: (url: string, target?: string) => void;
}

export const createSharedCensusBrowserRuntime = (
  runtime: CensusDialogRuntime = createCensusDialogRuntime()
): SharedCensusBrowserRuntime => ({
  alert: message => runtime.alert(message),
  open: (url, target = '_blank') => runtime.open(url, target),
});

export const defaultSharedCensusBrowserRuntime = createSharedCensusBrowserRuntime();
