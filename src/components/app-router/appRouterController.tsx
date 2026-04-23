import React from 'react';
import type { ModuleType } from '@/constants/navigationConfig';
import type { UserRole } from '@/context';
import {
  AuditView,
  BackupFilesView,
  CommunicationsView,
  ConfigurationView,
  DataMaintenanceView,
  DataView,
  ErrorDashboard,
  FunctionsTelemetryView,
  PatientMasterView,
  ReminderAdminView,
  RoleManagementView,
  SystemDiagnosticsView,
  TransferManagementView,
  WhatsAppIntegrationView,
} from '@/views/LazyViews';
import {
  canAccessAppModuleRoute,
  canEditAppModule,
  getVisibleAppModules,
} from '@/shared/access/operationalAccessPolicy';
import { resolveSpecialistCensusAccessProfile } from '@/shared/access/specialistAccessPolicy';
import { isE2EEditableRecordOverrideEnabled } from '@/shared/runtime/e2eRuntime';

export interface AppRouterResolvedContext {
  censusAccessProfile: ReturnType<typeof resolveSpecialistCensusAccessProfile>;
  visibleModules: ModuleType[];
  e2eEditableOverride: boolean;
}

export interface SimpleModuleRouteDefinition {
  module: ModuleType;
  sectionName: string;
  requiresAccessCheck?: boolean;
  render: () => React.ReactNode;
}

export const SIMPLE_MODULE_ROUTE_DEFINITIONS: readonly SimpleModuleRouteDefinition[] = [
  {
    module: 'AUDIT',
    sectionName: 'Auditoría',
    requiresAccessCheck: true,
    render: () => <AuditView />,
  },
  {
    module: 'FUNCTIONS_TELEMETRY',
    sectionName: 'Telemetría de Servicios',
    requiresAccessCheck: true,
    render: () => <FunctionsTelemetryView />,
  },
  {
    module: 'CONFIGURATION',
    sectionName: 'Configuración',
    requiresAccessCheck: true,
    render: () => <ConfigurationView />,
  },
  {
    module: 'DATA',
    sectionName: 'Datos',
    requiresAccessCheck: true,
    render: () => <DataView />,
  },
  {
    module: 'COMMUNICATIONS',
    sectionName: 'Comunicación',
    requiresAccessCheck: true,
    render: () => <CommunicationsView />,
  },
  {
    module: 'WHATSAPP',
    sectionName: 'Integración WhatsApp',
    render: () => <WhatsAppIntegrationView />,
  },
  {
    module: 'DIAGNOSTICS',
    sectionName: 'Diagnóstico del Sistema',
    requiresAccessCheck: true,
    render: () => <SystemDiagnosticsView />,
  },
  {
    module: 'TRANSFER_MANAGEMENT',
    sectionName: 'Traslados',
    render: () => <TransferManagementView />,
  },
  {
    module: 'BACKUP_FILES',
    sectionName: 'Respaldos',
    requiresAccessCheck: true,
    render: () => <BackupFilesView backupType="handoff" />,
  },
  {
    module: 'PATIENT_MASTER_INDEX',
    sectionName: 'Base de Pacientes',
    requiresAccessCheck: true,
    render: () => <PatientMasterView />,
  },
  {
    module: 'DATA_MAINTENANCE',
    sectionName: 'Mantenimiento de Datos',
    requiresAccessCheck: true,
    render: () => <DataMaintenanceView />,
  },
  {
    module: 'ROLE_MANAGEMENT',
    sectionName: 'Gestión de Roles',
    requiresAccessCheck: true,
    render: () => <RoleManagementView />,
  },
  {
    module: 'REMINDERS',
    sectionName: 'Avisos al Personal',
    requiresAccessCheck: true,
    render: () => <ReminderAdminView />,
  },
  {
    module: 'ERRORS',
    sectionName: 'Panel de Errores',
    requiresAccessCheck: true,
    render: () => <ErrorDashboard />,
  },
];

export const resolveAppRouterContext = (role: UserRole): AppRouterResolvedContext => ({
  censusAccessProfile: resolveSpecialistCensusAccessProfile(role),
  visibleModules: getVisibleAppModules(role),
  e2eEditableOverride: isE2EEditableRecordOverrideEnabled(),
});

export const resolveModuleReadOnly = ({
  role,
  module,
  e2eEditableOverride,
}: {
  role: UserRole;
  module: ModuleType;
  e2eEditableOverride: boolean;
}): boolean => !canEditAppModule(role, module) && !e2eEditableOverride;

export const canRenderSimpleModuleRoute = ({
  currentModule,
  route,
  role,
  visibleModules,
}: {
  currentModule: ModuleType;
  route: SimpleModuleRouteDefinition;
  role: UserRole;
  visibleModules: readonly ModuleType[];
}): boolean => {
  if (currentModule !== route.module) {
    return false;
  }

  if (!route.requiresAccessCheck) {
    return true;
  }

  return canAccessAppModuleRoute({
    role,
    module: route.module,
    visibleModules,
  });
};
