/**
 * Lazy-loaded view components
 * Loaded on-demand when the user navigates to them
 */
import { lazyWithRetry } from '@/utils/lazyWithRetry';

// Census module (prefetch for faster navigation)
export const CensusView = lazyWithRetry(() =>
  import(/* webpackPrefetch: true */ '@/features/census').then(module => ({
    default: module.CensusView,
  }))
);

export const CensusEmailConfigModal = lazyWithRetry(() =>
  import('@/features/census').then(module => ({
    default: module.CensusEmailConfigModal,
  }))
);

export const AnalyticsView = lazyWithRetry(() =>
  import('@/features/analytics').then(module => ({
    default: module.AnalyticsView,
  }))
);

// CUDYR module (prefetch)
export const CudyrView = lazyWithRetry(() =>
  import(/* webpackPrefetch: true */ '@/features/cudyr').then(module => ({
    default: module.CudyrView,
  }))
);

// Handoff module (prefetch)
export const HandoffView = lazyWithRetry(() =>
  import(/* webpackPrefetch: true */ '@/features/handoff').then(module => ({
    default: module.HandoffView,
  }))
);

// Admin modules
export const AuditView = lazyWithRetry(() =>
  import(/* webpackChunkName: "audit" */ '@/features/admin').then(module => ({
    default: module.AuditView,
  }))
);

export const MedicalSignatureView = lazyWithRetry(() =>
  import(/* webpackChunkName: "signature" */ '@/features/admin').then(module => ({
    default: module.MedicalSignatureView,
  }))
);

export const ErrorDashboard = lazyWithRetry(() =>
  import(/* webpackChunkName: "error-db" */ '@/features/admin').then(module => ({
    default: module.ErrorDashboard,
  }))
);

export const BackupFilesView = lazyWithRetry(() =>
  import(/* webpackChunkName: "backup" */ '@/features/backup').then(module => ({
    default: module.BackupFilesView,
  }))
);

// Health & Monitoring
export const SystemDiagnosticsView = lazyWithRetry(() =>
  import('@/features/admin').then(module => ({
    default: module.SystemDiagnosticsView,
  }))
);
export const PatientMasterView = lazyWithRetry(() =>
  import('@/features/admin').then(module => ({
    default: module.PatientMasterView,
  }))
);
export const DataMaintenanceView = lazyWithRetry(() =>
  import('@/features/admin').then(module => ({
    default: module.DataMaintenanceView,
  }))
);
export const RoleManagementView = lazyWithRetry(() =>
  import('@/features/admin').then(module => ({
    default: module.RoleManagementView,
  }))
);
export const ReminderAdminView = lazyWithRetry(() =>
  import('@/features/reminders').then(module => ({
    default: module.ReminderAdminView,
  }))
);

// WhatsApp module
export const WhatsAppIntegrationView = lazyWithRetry(() =>
  import(/* webpackChunkName: "whatsapp" */ '@/features/whatsapp').then(m => ({
    default: m.WhatsAppIntegrationView,
  }))
);

// Transfer Management module
export const TransferManagementView = lazyWithRetry(() =>
  import('@/features/transfers').then(module => ({
    default: module.TransferManagementView,
  }))
);
