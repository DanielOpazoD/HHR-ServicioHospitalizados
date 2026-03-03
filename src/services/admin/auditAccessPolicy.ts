import { UserRole } from '@/types';
import { ACTIONS, canDoAction, canViewModule, isAdmin } from '@/utils/permissions';

export const canAccessAuditView = (role: UserRole | undefined): boolean =>
  canViewModule(role, 'AUDIT') && canDoAction(role, ACTIONS.AUDIT_READ);

export const canAccessAuditSensitivePanels = (role: UserRole | undefined): boolean => isAdmin(role);

export const canExportAuditData = (role: UserRole | undefined): boolean =>
  canDoAction(role, ACTIONS.EXPORT_EXCEL) || canDoAction(role, ACTIONS.EXPORT_PDF);
