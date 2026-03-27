import type { UserRole } from '@/types/auth';
import type { TransferNote } from '@/types/transfers';
import type { TransferTableMode } from './transferTableController';

export const canManageTransferNotes = (
  role: UserRole | undefined,
  mode: TransferTableMode
): boolean => role === 'admin' && mode === 'active';

export const getSortedTransferNotes = (notes: TransferNote[] | undefined): TransferNote[] =>
  (notes || []).slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt));
