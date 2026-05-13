import { mergeArrayById } from '@/services/repositories/conflictResolutionMergeUtils';
import type { ConflictResolutionTraceContext } from '@/services/repositories/conflictResolutionTrace';

export const mergeMovementArrayById = <T>(
  remote: T[] = [],
  local: T[] = [],
  preferLocal: boolean,
  traceContext?: ConflictResolutionTraceContext,
  path = ''
): T[] => {
  if (preferLocal) {
    return mergeArrayById(remote, local, traceContext, path);
  }

  traceContext?.add({
    path,
    strategy: 'copy_remote_value',
    winner: 'remote',
    reason: 'remote_movement_snapshot_priority',
  });
  return remote;
};
