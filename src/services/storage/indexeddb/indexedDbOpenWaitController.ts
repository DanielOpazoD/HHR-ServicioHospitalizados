import type { IndexedDbOpenWaitOutcome } from './indexedDbCoreSupport';

export type IndexedDbOpenWaitAction = 'return' | 'fallback' | 'continue';

export const resolveIndexedDbOpenWaitAction = (
  waitOutcome: IndexedDbOpenWaitOutcome
): IndexedDbOpenWaitAction => {
  if (waitOutcome === 'opened' || waitOutcome === 'mock') {
    return 'return';
  }

  return waitOutcome === 'stalled' ? 'fallback' : 'continue';
};
