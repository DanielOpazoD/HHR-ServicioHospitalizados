import type { Functions } from 'firebase/functions';
import * as firebaseConfig from '@/firebaseConfig';

export interface FunctionsRuntime {
  ready: Promise<unknown>;
  getFunctions: () => Promise<Functions>;
}

export const defaultFunctionsRuntime: FunctionsRuntime = {
  ready:
    'firebaseReady' in firebaseConfig
      ? (firebaseConfig as { firebaseReady: Promise<unknown> }).firebaseReady
      : Promise.resolve(),
  getFunctions: () => firebaseConfig.getFunctionsInstance(),
};
