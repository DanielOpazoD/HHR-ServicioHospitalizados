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
import {
  canRenderSimpleModuleRoute,
  resolveAppRouterContext,
  resolveModuleReadOnly,
  SIMPLE_MODULE_ROUTE_DEFINITIONS,
} from '@/components/app-router/appRouterController';

// Lazy-loaded views
import {
  AnalyticsView,
  CensusView,
  CudyrView,
  HandoffView,
  MedicalSignatureView,
} from '@/views/LazyViews';
import { canForceCreateDayCopyOverride } from '@/shared/access/operationalAccessPolicy';

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
  const { censusAccessProfile, visibleModules, e2eEditableOverride } =
    resolveAppRouterContext(role);

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
                  readOnly={resolveModuleReadOnly({
                    role,
                    module: 'CENSUS',
                    e2eEditableOverride,
                  })}
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
                <CudyrView
                  readOnly={resolveModuleReadOnly({
                    role,
                    module: 'CUDYR',
                    e2eEditableOverride,
                  })}
                />
              </SectionErrorBoundary>
            )}
            {currentModule === 'NURSING_HANDOFF' && (
              <SectionErrorBoundary sectionName="Entrega Enfermería">
                <HandoffView
                  ui={ui}
                  type="nursing"
                  readOnly={resolveModuleReadOnly({
                    role,
                    module: 'NURSING_HANDOFF',
                    e2eEditableOverride,
                  })}
                />
              </SectionErrorBoundary>
            )}
            {currentModule === 'MEDICAL_HANDOFF' && (
              <SectionErrorBoundary sectionName="Entrega Médica">
                <HandoffView
                  ui={ui}
                  type="medical"
                  readOnly={resolveModuleReadOnly({
                    role,
                    module: 'MEDICAL_HANDOFF',
                    e2eEditableOverride,
                  })}
                />
              </SectionErrorBoundary>
            )}
            {SIMPLE_MODULE_ROUTE_DEFINITIONS.filter(route =>
              canRenderSimpleModuleRoute({
                currentModule,
                route,
                role,
                visibleModules,
              })
            ).map(route => (
              <SectionErrorBoundary key={route.module} sectionName={route.sectionName}>
                {route.render()}
              </SectionErrorBoundary>
            ))}
          </>
        )}
      </Suspense>
    </GlobalErrorBoundary>
  );
};
