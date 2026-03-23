/**
 * Lazy-loaded view components
 * Loaded on-demand when the user navigates to them
 */
import { lazy } from 'react';

// Census module (prefetch for faster navigation)
export const CensusView = lazy(() =>
  import(/* webpackPrefetch: true */ '@/features/census').then(module => ({
    default: module.CensusView,
  }))
);

export const SharedCensusView = lazy(() =>
  import(/* webpackChunkName: "shared-census" */ '@/features/census').then(module => ({
    default: module.SharedCensusView,
  }))
);

export const CensusEmailConfigModal = lazy(() =>
  import('@/features/census').then(module => ({
    default: module.CensusEmailConfigModal,
  }))
);

// CUDYR module (prefetch)
export const CudyrView = lazy(() =>
  import(/* webpackPrefetch: true */ '@/features/cudyr').then(module => ({
    default: module.CudyrView,
  }))
);

// Handoff module (prefetch)
export const HandoffView = lazy(() =>
  import(/* webpackPrefetch: true */ '@/features/handoff').then(module => ({
    default: module.HandoffView,
  }))
);

// Admin modules
export const AuditView = lazy(() =>
  import(/* webpackChunkName: "audit" */ '@/features/admin').then(module => ({
    default: module.AuditView,
  }))
);

export const MedicalSignatureView = lazy(() =>
  import(/* webpackChunkName: "signature" */ '@/features/admin').then(module => ({
    default: module.MedicalSignatureView,
  }))
);

export const ErrorDashboard = lazy(() =>
  import(/* webpackChunkName: "error-db" */ '@/features/admin').then(module => ({
    default: module.ErrorDashboard,
  }))
);

export const BackupFilesView = lazy(() =>
  import(/* webpackChunkName: "backup" */ '@/features/backup').then(module => ({
    default: module.BackupFilesView,
  }))
);

// Health & Monitoring
export const SystemDiagnosticsView = lazy(() =>
  import('@/features/admin').then(module => ({
    default: module.SystemDiagnosticsView,
  }))
);
export const PatientMasterView = lazy(() =>
  import('@/features/admin').then(module => ({
    default: module.PatientMasterView,
  }))
);
export const DataMaintenanceView = lazy(() =>
  import('@/features/admin').then(module => ({
    default: module.DataMaintenanceView,
  }))
);
export const RoleManagementView = lazy(() =>
  import('@/features/admin').then(module => ({
    default: module.RoleManagementView,
  }))
);
export const ReminderAdminView = lazy(() =>
  import('@/features/reminders').then(module => ({
    default: module.ReminderAdminView,
  }))
);

// WhatsApp module
export const WhatsAppIntegrationView = lazy(() =>
  import(/* webpackChunkName: "whatsapp" */ '@/features/whatsapp').then(m => ({
    default: m.WhatsAppIntegrationView,
  }))
);

// Transfer Management module
export const TransferManagementView = lazy(() =>
  import('@/features/transfers').then(module => ({
    default: module.TransferManagementView,
  }))
);
