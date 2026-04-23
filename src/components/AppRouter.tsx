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
  resolveAllowAdminCopyOverride,
  resolveAppRouterContext,
  resolveCoreModuleRoute,
  resolveModuleReadOnly,
  resolveSimpleModuleRoute,
  SIGNATURE_ROUTE_DEFINITION,
} from '@/components/app-router/appRouterController';

interface AppRouterProps {
  /** Global UI state */
  ui: UseUIStateReturn;
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
  selectedDay,
  selectedMonth,
  currentDateString,
  role,
  isSignatureMode,
  showBedManagerModal,
  onCloseBedManagerModal,
  onOpenCensusDate,
}) => {
  const currentModule = ui.currentModule;
  const { censusAccessProfile, visibleModules, e2eEditableOverride } =
    resolveAppRouterContext(role);
  const resolveReadOnly = (module: ModuleType) =>
    resolveModuleReadOnly({
      role,
      module,
      e2eEditableOverride,
    });
  const allowAdminCopyOverride = resolveAllowAdminCopyOverride(role);
  const coreRoute = resolveCoreModuleRoute(currentModule);
  const simpleRoute = resolveSimpleModuleRoute(currentModule);

  return (
    <GlobalErrorBoundary>
      <Suspense fallback={<ViewLoader />}>
        {isSignatureMode ? (
          <SectionErrorBoundary sectionName={SIGNATURE_ROUTE_DEFINITION.sectionName}>
            {SIGNATURE_ROUTE_DEFINITION.render({
              ui,
              selectedDay,
              selectedMonth,
              currentDateString,
              showBedManagerModal,
              onCloseBedManagerModal,
              onOpenCensusDate,
              resolveReadOnly,
              allowAdminCopyOverride,
              censusAccessProfile,
            })}
          </SectionErrorBoundary>
        ) : (
          <>
            {coreRoute && (
              <SectionErrorBoundary sectionName={coreRoute.sectionName}>
                {coreRoute.render({
                  ui,
                  selectedDay,
                  selectedMonth,
                  currentDateString,
                  showBedManagerModal,
                  onCloseBedManagerModal,
                  onOpenCensusDate,
                  resolveReadOnly,
                  allowAdminCopyOverride,
                  censusAccessProfile,
                })}
              </SectionErrorBoundary>
            )}
            {simpleRoute &&
              canRenderSimpleModuleRoute({
                currentModule,
                route: simpleRoute,
                role,
                visibleModules,
              }) && (
                <SectionErrorBoundary sectionName={simpleRoute.sectionName}>
                  {simpleRoute.render()}
                </SectionErrorBoundary>
              )}
          </>
        )}
      </Suspense>
    </GlobalErrorBoundary>
  );
};
