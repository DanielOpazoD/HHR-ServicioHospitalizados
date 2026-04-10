/**
 * AppRouter
 * Handles module-based routing within the application.
 * Extracted from App.tsx to reduce component size.
 */

import React, { Suspense } from 'react';
import { GlobalErrorBoundary } from '@/components/shared/GlobalErrorBoundary';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { ViewLoader } from '@/components/ui/ViewLoader';
import { UserRole } from '@/context';
import { UseUIStateReturn } from '@/hooks/useUIState';
import type { ModuleType } from '@/constants/navigationConfig';

// Lazy-loaded views
import {
  AnalyticsView,
  CensusView,
  CudyrView,
  HandoffView,
  AuditView,
  MedicalSignatureView,
  ErrorDashboard,
  WhatsAppIntegrationView,
  SystemDiagnosticsView,
  TransferManagementView,
  BackupFilesView,
  PatientMasterView,
  DataMaintenanceView,
  RoleManagementView,
  ReminderAdminView,
} from '@/views/LazyViews';
import type { CensusAccessProfile } from '@/shared/access/censusAccessProfile';
import { resolveSpecialistCensusAccessProfile } from '@/shared/access/specialistAccessPolicy';
import {
  canAccessAppModuleRoute,
  canEditAppModule,
  canForceCreateDayCopyOverride,
  getVisibleAppModules,
} from '@/shared/access/operationalAccessPolicy';
import { isE2EEditableRecordOverrideEnabled } from '@/shared/runtime/e2eRuntime';

export type AppModule = ModuleType;
export type CensusViewMode = 'REGISTER' | 'ANALYTICS';

interface AppRouterProps {
  /** Global UI state */
  ui: UseUIStateReturn;
  /** Current active module */
  currentModule: AppModule;
  /** Census sub-view mode */
  censusViewMode: CensusViewMode;
  /** Selected day for census */
  selectedDay: number;
  /** Selected month for census */
  selectedMonth: number;
  /** Current date string (YYYY-MM-DD) */
  currentDateString: string;
  /** User's role for permissions */
  role: UserRole;
  /** Whether in signature collection mode */
  isSignatureMode: boolean;
  /** Whether bed manager modal is open */
  showBedManagerModal: boolean;
  /** Callback to close bed manager modal */
  onCloseBedManagerModal: () => void;
  /** Callback to open the daily census at a specific date */
  onOpenCensusDate?: (date: string) => void;
}

/**
 * Routes to the appropriate view based on currentModule.
 * Wraps all views with ErrorBoundary and Suspense for lazy loading.
 */
export const AppRouter: React.FC<AppRouterProps> = ({
  ui,
  currentModule,
  censusViewMode: _censusViewMode,
  selectedDay,
  selectedMonth,
  currentDateString,
  role,
  isSignatureMode,
  showBedManagerModal,
  onCloseBedManagerModal,
  onOpenCensusDate,
}) => {
  const censusAccessProfile: CensusAccessProfile = resolveSpecialistCensusAccessProfile(role);
  const visibleModules = getVisibleAppModules(role);
  const e2eEditableOverride = isE2EEditableRecordOverrideEnabled();

  return (
    <GlobalErrorBoundary>
      <Suspense fallback={<ViewLoader />}>
        {isSignatureMode ? (
          <SectionErrorBoundary sectionName="Firma Médica">
            <MedicalSignatureView />
          </SectionErrorBoundary>
        ) : (
          <>
            {currentModule === 'CENSUS' && (
              <SectionErrorBoundary sectionName="Censo">
                <CensusView
                  selectedDay={selectedDay}
                  selectedMonth={selectedMonth}
                  currentDateString={currentDateString}
                  showBedManagerModal={showBedManagerModal}
                  onCloseBedManagerModal={onCloseBedManagerModal}
                  onOpenCensusDate={onOpenCensusDate}
                  readOnly={!canEditAppModule(role, 'CENSUS') && !e2eEditableOverride}
                  allowAdminCopyOverride={canForceCreateDayCopyOverride(role)}
                  accessProfile={censusAccessProfile}
                />
              </SectionErrorBoundary>
            )}
            {currentModule === 'ANALYTICS' && (
              <SectionErrorBoundary sectionName="Estadísticas MINSAL/DEIS">
                <AnalyticsView onOpenCensusDate={onOpenCensusDate} />
              </SectionErrorBoundary>
            )}
            {currentModule === 'CUDYR' && (
              <SectionErrorBoundary sectionName="CUDYR">
                <CudyrView readOnly={!canEditAppModule(role, 'CUDYR') && !e2eEditableOverride} />
              </SectionErrorBoundary>
            )}
            {currentModule === 'NURSING_HANDOFF' && (
              <SectionErrorBoundary sectionName="Entrega Enfermería">
                <HandoffView
                  ui={ui}
                  type="nursing"
                  readOnly={!canEditAppModule(role, 'NURSING_HANDOFF') && !e2eEditableOverride}
                />
              </SectionErrorBoundary>
            )}
            {currentModule === 'MEDICAL_HANDOFF' && (
              <SectionErrorBoundary sectionName="Entrega Médica">
                <HandoffView
                  ui={ui}
                  type="medical"
                  readOnly={!canEditAppModule(role, 'MEDICAL_HANDOFF') && !e2eEditableOverride}
                />
              </SectionErrorBoundary>
            )}
            {currentModule === 'AUDIT' &&
              canAccessAppModuleRoute({ role, module: 'AUDIT', visibleModules }) && (
                <SectionErrorBoundary sectionName="Auditoría">
                  <AuditView />
                </SectionErrorBoundary>
              )}
            {currentModule === 'WHATSAPP' && (
              <SectionErrorBoundary sectionName="Integración WhatsApp">
                <WhatsAppIntegrationView />
              </SectionErrorBoundary>
            )}
            {currentModule === 'DIAGNOSTICS' &&
              canAccessAppModuleRoute({ role, module: 'DIAGNOSTICS', visibleModules }) && (
                <SectionErrorBoundary sectionName="Diagnóstico del Sistema">
                  <SystemDiagnosticsView />
                </SectionErrorBoundary>
              )}
            {currentModule === 'TRANSFER_MANAGEMENT' && (
              <SectionErrorBoundary sectionName="Traslados">
                <TransferManagementView />
              </SectionErrorBoundary>
            )}
            {currentModule === 'BACKUP_FILES' &&
              canAccessAppModuleRoute({ role, module: 'BACKUP_FILES', visibleModules }) && (
                <SectionErrorBoundary sectionName="Respaldos">
                  <BackupFilesView backupType="handoff" />
                </SectionErrorBoundary>
              )}
            {currentModule === 'PATIENT_MASTER_INDEX' &&
              canAccessAppModuleRoute({
                role,
                module: 'PATIENT_MASTER_INDEX',
                visibleModules,
              }) && (
                <SectionErrorBoundary sectionName="Base de Pacientes">
                  <PatientMasterView />
                </SectionErrorBoundary>
              )}
            {currentModule === 'DATA_MAINTENANCE' &&
              canAccessAppModuleRoute({ role, module: 'DATA_MAINTENANCE', visibleModules }) && (
                <SectionErrorBoundary sectionName="Mantenimiento de Datos">
                  <DataMaintenanceView />
                </SectionErrorBoundary>
              )}
            {currentModule === 'ROLE_MANAGEMENT' &&
              canAccessAppModuleRoute({ role, module: 'ROLE_MANAGEMENT', visibleModules }) && (
                <SectionErrorBoundary sectionName="Gestión de Roles">
                  <RoleManagementView />
                </SectionErrorBoundary>
              )}
            {currentModule === 'REMINDERS' &&
              canAccessAppModuleRoute({ role, module: 'REMINDERS', visibleModules }) && (
                <SectionErrorBoundary sectionName="Avisos al Personal">
                  <ReminderAdminView />
                </SectionErrorBoundary>
              )}
            {currentModule === 'ERRORS' &&
              canAccessAppModuleRoute({ role, module: 'ERRORS', visibleModules }) && (
                <SectionErrorBoundary sectionName="Panel de Errores">
                  <ErrorDashboard />
                </SectionErrorBoundary>
              )}
          </>
        )}
      </Suspense>
    </GlobalErrorBoundary>
  );
};
