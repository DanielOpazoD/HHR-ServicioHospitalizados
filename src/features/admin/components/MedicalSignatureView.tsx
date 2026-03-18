import React, { useMemo, useState } from 'react';
import { PenTool, CheckCircle } from 'lucide-react';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntime';
import { HandoffView } from '@/features/handoff';
import { DailyRecordProvider } from '@/context/DailyRecordContext';
import { StaffContextProvider, type StaffContextType } from '@/context/StaffContext';
import { resolveMedicalHandoffScope, resolveScopedMedicalSignature } from '@/features/handoff';
import { createPublicMedicalSignatureContextValue } from '@/features/admin/controllers/publicMedicalSignatureContextController';
import { usePublicMedicalSignature } from '@/features/admin/hooks/usePublicMedicalSignature';
import { formatHandoffDateTime } from '@/shared/handoff/handoffPresentation';

const EMPTY_STAFF_CONTEXT: StaffContextType = {
  nursesList: [],
  setNursesList: () => {},
  nursesLoading: false,
  tensList: [],
  setTensList: () => {},
  tensLoading: false,
  professionalsCatalog: [],
  setProfessionalsCatalog: () => {},
  professionalsLoading: false,
  showNurseManager: false,
  setShowNurseManager: () => {},
  showTensManager: false,
  setShowTensManager: () => {},
};

const normalizeSignatureDate = (rawDate: string | null): string | null => {
  if (!rawDate) return null;

  if (rawDate.includes('-') && rawDate.split('-')[0]?.length <= 2) {
    const [day, month, year] = rawDate.split('-');
    if (!day || !month || !year) return null;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return rawDate;
};

export const MedicalSignatureView: React.FC = () => {
  const [doctorName, setDoctorName] = useState('');
  const [isSignedLocal, setIsSignedLocal] = useState(false);

  const locationHref = defaultBrowserWindowRuntime.getLocationHref();
  const searchParams = useMemo(
    () => (locationHref ? new URL(locationHref).searchParams : new URLSearchParams()),
    [locationHref]
  );
  const medicalScope = resolveMedicalHandoffScope(searchParams.get('scope'));
  const signatureToken = searchParams.get('token');
  const signatureDate = normalizeSignatureDate(searchParams.get('date'));

  const { record, isLoading, isSigning, sign, error, signError } = usePublicMedicalSignature(
    signatureDate,
    medicalScope,
    signatureToken
  );

  const dailyRecordContext = useMemo(
    () =>
      createPublicMedicalSignatureContextValue({
        record,
        onSign: async name => {
          await sign(name);
          setIsSignedLocal(true);
        },
      }),
    [record, sign]
  );

  if (!signatureToken || !signatureDate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-amber-900">Enlace de firma inválido</h2>
          <p className="mt-2 text-sm text-amber-800">
            Este enlace no contiene la información necesaria para cargar la entrega médica.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
        <p className="text-slate-500">Cargando entrega de turno...</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-rose-900">No fue posible abrir la entrega</h2>
          <p className="mt-2 text-sm text-rose-800">
            {error instanceof Error
              ? error.message
              : 'El enlace puede haber expirado o no corresponder a una entrega disponible.'}
          </p>
        </div>
      </div>
    );
  }

  const existingSignature = resolveScopedMedicalSignature(record, medicalScope);
  const isSigned = Boolean(existingSignature) || isSignedLocal;
  const signatureData = existingSignature || { doctorName, signedAt: new Date().toISOString() };

  const handleSign = async () => {
    if (!doctorName.trim()) return;

    try {
      await sign(doctorName.trim());
      setIsSignedLocal(true);
    } catch (submitError) {
      console.error('Error signing handoff:', submitError);
      defaultBrowserWindowRuntime.alert(
        'Error al firmar la entrega. Por favor intente nuevamente.'
      );
    }
  };

  return (
    <DailyRecordProvider value={dailyRecordContext}>
      <StaffContextProvider value={EMPTY_STAFF_CONTEXT}>
        <div className="min-h-screen bg-slate-50 pb-32">
          <div className="pointer-events-none select-none">
            <HandoffView type="medical" readOnly={true} medicalScope={medicalScope} />
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white p-6 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] print:hidden">
            <div className="mx-auto max-w-3xl">
              {isSigned ? (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="rounded-full bg-green-100 p-1.5 text-green-600">
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-green-800">Entrega Recibida y Firmada</h3>
                    <p className="text-xs text-green-700">
                      Firmado por <strong>{signatureData.doctorName}</strong> el{' '}
                      {formatHandoffDateTime(signatureData.signedAt)}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
                    <PenTool className="text-purple-600" />
                    Recepción de Turno Médico
                  </h3>

                  <div className="flex flex-col gap-4 sm:flex-row">
                    <input
                      type="text"
                      placeholder="Nombre y Apellido del Médico"
                      value={doctorName}
                      onChange={event => setDoctorName(event.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 p-3 text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => void handleSign()}
                      disabled={!doctorName.trim() || isSigning}
                      className="whitespace-nowrap rounded-lg bg-purple-600 px-8 py-3 text-lg font-bold text-white shadow-md transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSigning ? 'Firmando...' : 'Firmar y Recibir'}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Al firmar, certifica que ha leído y recibido la entrega de turno conforme.
                  </p>
                  {signError instanceof Error && (
                    <p className="mt-2 text-sm text-rose-600">{signError.message}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </StaffContextProvider>
    </DailyRecordProvider>
  );
};
