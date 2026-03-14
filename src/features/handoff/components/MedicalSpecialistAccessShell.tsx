import React from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';

import { AppProviders } from '@/components/AppProviders';
import { useAuth } from '@/context/AuthContext';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import type { DailyRecordContextType } from '@/hooks/useDailyRecordTypes';

const SpecialistHandoffView = React.lazy(() =>
  import('@/features/handoff/components/HandoffView').then(module => ({
    default: module.HandoffView,
  }))
);

interface MedicalSpecialistAccessShellProps {
  dailyRecordHook: DailyRecordContextType;
  medicalScope: MedicalHandoffScope;
  specialty: string | 'all';
}

const formatScopeLabel = (scope: MedicalHandoffScope): string => {
  if (scope === 'upc') return 'UPC';
  if (scope === 'no-upc') return 'No UPC';
  return 'Todos';
};

export const MedicalSpecialistAccessShell: React.FC<MedicalSpecialistAccessShellProps> = ({
  dailyRecordHook,
  medicalScope,
  specialty,
}) => {
  const auth = useAuth();

  return (
    <AppProviders dailyRecordHook={dailyRecordHook}>
      <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <header className="rounded-2xl border border-sky-100 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Acceso restringido especialista
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900">Entrega de Turno Médicos</h1>
                  <p className="text-sm text-slate-500">
                    Puedes editar observaciones médicas y eventos clínicos. El resto de la
                    aplicación permanece bloqueado.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 md:items-end">
                <div className="text-sm text-slate-500">
                  <div className="font-semibold text-slate-700">
                    {auth.user?.displayName || auth.user?.email || 'Especialista autorizado'}
                  </div>
                  <div>
                    Alcance: {formatScopeLabel(medicalScope)}
                    {specialty !== 'all' ? ` · ${specialty}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void auth.signOut()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </header>

          <React.Suspense fallback={null}>
            <SpecialistHandoffView
              type="medical"
              readOnly={false}
              medicalScope={medicalScope}
              specialistAccess={true}
            />
          </React.Suspense>
        </div>
      </div>
    </AppProviders>
  );
};
