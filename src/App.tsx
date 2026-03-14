/**
 * App.tsx - Main Application Component
 *
 * Orchestrates authentication, routing, and global state.
 * Extracted components: AppProviders, AppRouter
 */

import React from 'react';
import {
  useDailyRecord,
  useDateNavigation,
  useFileOperations,
  useExistingDaysQuery,
  useCensusEmail,
  useMedicalSpecialistMode,
  useSignatureMode,
  useSharedCensusMode,
  useAppState,
  useVersionCheck,
} from '@/hooks';
import { UseDateNavigationReturn } from '@/hooks/useDateNavigation';
import { useStorageMigration } from '@/hooks/useStorageMigration';
import { useSystemHealthReporter } from '@/hooks/admin/useSystemHealthReporter';
import { LoginPage } from '@/features/auth';
import { GlobalErrorBoundary } from '@/components/shared/GlobalErrorBoundary';
import { AppContent } from '@/components/layout/AppContent';
import { CensusProvider, CensusContextType } from '@/context/CensusContext';
import { VersionProvider } from '@/context/VersionContext';
import { VersionMismatchOverlay } from '@/components/shared/VersionMismatchOverlay';
import { ViewLoader } from '@/components/ui/ViewLoader';
import { MedicalSignatureView } from '@/views/LazyViews';
import { AuditProvider, useAuth, AuthContextType, AuthProvider, UIProvider } from './context';
import { HospitalProvider } from './context/HospitalContext';
import { RepositoryProvider, defaultRepositories } from '@/services/RepositoryContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/config/queryClient';
import { setFirestoreEnabled } from '@/services/repositories/DailyRecordRepository';
import { resolveShiftNurseSignature } from '@/services/staff/dailyRecordStaffing';
import { MedicalSpecialistAccessShell } from '@/features/handoff/components/MedicalSpecialistAccessShell';
import { LogOut, ShieldAlert } from 'lucide-react';

// ============================================================================
// Sync Effect - Keeps repository in sync with Firebase connection status
// ============================================================================
const isIgnorableWorkerShutdownImportError = (error: unknown): boolean => {
  const message = String(error);
  return message.includes('[vitest-worker]: Closing rpc while "fetch" was pending');
};

const useSyncFirestoreStatus = (isFirebaseConnected: boolean) => {
  React.useEffect(() => {
    try {
      setFirestoreEnabled(isFirebaseConnected);
    } catch (error) {
      if (isIgnorableWorkerShutdownImportError(error)) {
        return;
      }
      console.error('[App] Failed to sync Firestore status', error);
    }
  }, [isFirebaseConnected]);
};

// ============================================================================
// Main App Component
// ============================================================================
function App() {
  // Auth state
  const auth = useAuth();
  // Storage migration only matters once a real session is active.
  useStorageMigration({ enabled: !auth.isLoading && !!auth.user });

  // Version check (auto-refresh on new deployments)
  useVersionCheck();

  useSyncFirestoreStatus(auth.isFirebaseConnected);

  // Date navigation
  const dateNav = useDateNavigation();

  const { isSignatureMode, currentDateString } = useSignatureMode(
    dateNav.currentDateString,
    auth.user,
    auth.isLoading
  );
  const medicalSpecialist = useMedicalSpecialistMode();
  const sharedCensus = useSharedCensusMode();

  if (isSignatureMode) {
    return (
      <VersionProvider>
        <VersionMismatchOverlay />
        <React.Suspense fallback={<ViewLoader />}>
          <MedicalSignatureView />
        </React.Suspense>
      </VersionProvider>
    );
  }

  // Loading state
  if (
    auth.isLoading ||
    (medicalSpecialist.isSpecialistMedicalHandoffMode && medicalSpecialist.isLoading) ||
    (sharedCensus.isSharedCensusMode && sharedCensus.isLoading)
  ) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-pulse text-medical-600 text-xl font-bold">Cargando...</div>
      </div>
    );
  }

  // Auth required for main app (NOT shared census mode)
  if (!auth.user && !isSignatureMode && !sharedCensus.isSharedCensusMode) {
    if (medicalSpecialist.isSpecialistMedicalHandoffMode) {
      return <LoginPage onLoginSuccess={() => {}} accessMode="specialist-medical-handoff" />;
    }
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  // If in shared census mode and user needs to login, show login page
  // This is a SEPARATE login flow from the main app
  if (sharedCensus.isSharedCensusMode && sharedCensus.needsLogin) {
    return <LoginPage onLoginSuccess={() => {}} accessMode="shared-census" />;
  }

  if (medicalSpecialist.isSpecialistMedicalHandoffMode && medicalSpecialist.needsLogin) {
    return <LoginPage onLoginSuccess={() => {}} accessMode="specialist-medical-handoff" />;
  }

  return (
    <VersionProvider>
      <VersionMismatchOverlay />
      <AppInner
        auth={auth}
        dateNav={{ ...dateNav, isSignatureMode, currentDateString }}
        medicalSpecialist={medicalSpecialist}
        sharedCensus={sharedCensus}
      />
    </VersionProvider>
  );
}

const SpecialistAccessNotice: React.FC<{
  title: string;
  message: string;
  onLogout: () => Promise<void>;
}> = ({ title, message, onLogout }) => (
  <div className="min-h-screen bg-slate-100 px-4 py-10">
    <div className="mx-auto max-w-lg rounded-3xl border border-amber-100 bg-white p-8 shadow-sm">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
        <ShieldAlert className="h-3.5 w-3.5" />
        Acceso restringido
      </div>
      <h1 className="text-2xl font-black text-slate-900">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{message}</p>
      <button
        type="button"
        onClick={() => void onLogout()}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-black"
      >
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </button>
    </div>
  </div>
);

/**
 * Inner component to handle hook instantiation AFTER providers are balanced
 */
interface AppInnerProps {
  auth: AuthContextType;
  dateNav: UseDateNavigationReturn & { isSignatureMode: boolean; currentDateString: string };
  medicalSpecialist: ReturnType<typeof useMedicalSpecialistMode>;
  sharedCensus: ReturnType<typeof useSharedCensusMode>;
}

function AppInner({ auth, dateNav, medicalSpecialist, sharedCensus }: AppInnerProps) {
  // Report health status in background
  useSystemHealthReporter();

  const dailyRecordHook = useDailyRecord(
    dateNav.currentDateString,
    false,
    auth.isFirebaseConnected
  );
  const { record } = dailyRecordHook;

  const { data: existingDaysInMonth = [] } = useExistingDaysQuery(
    dateNav.selectedYear,
    dateNav.selectedMonth
  );
  const nurseSignature = React.useMemo(() => resolveShiftNurseSignature(record, 'night'), [record]);

  const censusEmail = useCensusEmail({
    record,
    currentDateString: dateNav.currentDateString,
    nurseSignature,
    selectedYear: dateNav.selectedYear,
    selectedMonth: dateNav.selectedMonth,
    selectedDay: dateNav.selectedDay,
    user: auth.user,
    role: auth.role,
  });

  const fileOps = useFileOperations(record, dailyRecordHook.refresh);
  const ui = useAppState();

  if (medicalSpecialist.isSpecialistMedicalHandoffMode && medicalSpecialist.error) {
    return (
      <SpecialistAccessNotice
        title="Acceso especialista no autorizado"
        message={medicalSpecialist.error}
        onLogout={auth.signOut}
      />
    );
  }

  // Construct Domain Context Value
  const censusContextValue: CensusContextType = {
    dailyRecord: dailyRecordHook,
    dateNav: {
      ...dateNav,
      existingDaysInMonth: existingDaysInMonth || [],
    },
    fileOps,
    censusEmail,
    nurseSignature,
    sharedCensus,
  };

  return (
    <CensusProvider value={censusContextValue}>
      {medicalSpecialist.isSpecialistMedicalHandoffMode ? (
        <MedicalSpecialistAccessShell
          dailyRecordHook={dailyRecordHook}
          medicalScope={medicalSpecialist.scope}
          specialty={medicalSpecialist.specialty}
        />
      ) : (
        <AppContent ui={ui} />
      )}
    </CensusProvider>
  );
}

// Wrap with Global Error Boundary
const AppWithErrorBoundary = () => {
  return (
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  );
};

export default function ProvidedApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RepositoryProvider value={defaultRepositories}>
          <HospitalProvider>
            <UIProvider>
              <AuditProvider userId="anon">
                <AppWithErrorBoundary />
              </AuditProvider>
            </UIProvider>
          </HospitalProvider>
        </RepositoryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
