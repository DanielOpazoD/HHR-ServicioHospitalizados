import { UserRole } from '@/types/auth';
import {
  canAccessAuditSensitivePanelsForRole,
  canAccessAuditViewForRole,
  canExportAuditDataForRole,
} from '@/shared/access/operationalAccessPolicy';

export const canAccessAuditView = (role: UserRole | undefined): boolean =>
  canAccessAuditViewForRole(role);

export const canAccessAuditSensitivePanels = (role: UserRole | undefined): boolean =>
  canAccessAuditSensitivePanelsForRole(role);

export const canExportAuditData = (role: UserRole | undefined): boolean =>
  canExportAuditDataForRole(role);
