import React, { useRef } from 'react';
import { Camera, CheckCircle2, Loader2, Pill, RotateCcw, Upload, XCircle } from 'lucide-react';
import {
  PRESCRIPTION_TYPE_LABELS,
  PRESCRIPTION_TYPES,
  type PrescriptionType,
} from '@/types/prescriptionTypes';
import type { PrescriptionUploadControllerHandle } from '@/features/prescriptions/hooks/usePrescriptionUploadController';

interface PrescriptionUploadFormProps {
  controller: PrescriptionUploadControllerHandle;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const renderPrescriptionTypeIcon = (type: PrescriptionType) => {
  if (type === 'comun') {
    return <Pill size={18} className="shrink-0 text-sky-600" aria-hidden data-testid="icon-pill" />;
  }

  if (type === 'psicotropicos') {
    return (
      <span
        aria-hidden
        data-testid="icon-white-circle"
        className="h-4 w-4 shrink-0 rounded-full border border-slate-400 bg-white shadow-inner"
      />
    );
  }

  return (
    <span
      aria-hidden
      data-testid="icon-green-circle"
      className="h-4 w-4 shrink-0 rounded-full border border-emerald-700 bg-emerald-500 shadow-inner"
    />
  );
};

export const PrescriptionUploadForm: React.FC<PrescriptionUploadFormProps> = ({ controller }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    phase,
    values,
    setField,
    errorMessage,
    previewObjectUrl,
    handleImageFile,
    clearCompressedImage,
    submitForm,
    resetAfterSuccess,
    lastResult,
    hasCompressedImage,
    patientOptions,
    patientOptionsPhase,
    patientOptionsError,
  } = controller;

  const isBusy = phase === 'compressing' || phase === 'uploading';
  const submitDisabled = isBusy || !hasCompressedImage;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleImageFile(file);
    event.target.value = '';
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitForm();
  };

  if (phase === 'success' && lastResult) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
        <CheckCircle2 size={36} className="mx-auto mb-3 text-emerald-600" />
        <h2 className="mb-1 text-lg font-semibold text-emerald-900">Receta registrada</h2>
        <p className="text-sm text-emerald-800">
          La foto se guardó como respaldo transitorio. Se eliminará automáticamente el{' '}
          <span className="font-semibold">
            {new Date(lastResult.expiresAt).toLocaleDateString('es-CL')}
          </span>
          .
        </p>
        <button
          type="button"
          onClick={resetAfterSuccess}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <RotateCcw size={14} /> Subir otra receta
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header>
        <h1 className="text-lg font-semibold text-slate-800">Subir foto de receta</h1>
        <p className="mt-1 text-xs text-slate-500">
          Respaldo transitorio del servicio. La receta original queda en farmacia. Las fotos se
          eliminan a los 30 días.
        </p>
      </header>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tipo de receta
        </legend>
        <div className="flex flex-col gap-2">
          {PRESCRIPTION_TYPES.map(type => (
            <label
              key={type}
              data-testid={`prescription-type-option-${type}`}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                values.prescriptionType === type
                  ? 'border-sky-500 bg-sky-50 text-sky-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="prescriptionType"
                value={type}
                checked={values.prescriptionType === type}
                onChange={() => setField('prescriptionType', type as PrescriptionType)}
                disabled={isBusy}
                className="accent-sky-600"
              />
              {renderPrescriptionTypeIcon(type)}
              {PRESCRIPTION_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Paciente
        </legend>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={values.patientUnassigned}
            onChange={event => setField('patientUnassigned', event.target.checked)}
            disabled={isBusy}
            className="accent-slate-600"
          />
          Sin paciente asignado (asignar después en el visor)
        </label>
        {!values.patientUnassigned && (
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-slate-500">Cama / paciente / RUT</span>
              <select
                value={values.selectedPatientKey}
                onChange={event => setField('selectedPatientKey', event.target.value)}
                disabled={isBusy || patientOptionsPhase === 'loading'}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100"
              >
                <option value="">
                  {patientOptionsPhase === 'loading'
                    ? 'Cargando camas del censo...'
                    : 'Selecciona cama - paciente - RUT'}
                </option>
                {patientOptions.map(option => (
                  <option key={option.key} value={option.key}>
                    {option.bedId} - {option.patientName || 'Sin nombre'}
                    {option.patientRut ? ` - ${option.patientRut}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {patientOptionsPhase === 'error' && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {patientOptionsError ?? 'No se pudo cargar el censo diario.'} Puedes marcar sin
                paciente asignado y asignar después en el visor.
              </p>
            )}
            {patientOptionsPhase === 'ready' && patientOptions.length === 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No hay camas activas con paciente en el censo de hoy. Marca sin paciente asignado
                para subir la receta y asignarla después.
              </p>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Foto
        </legend>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        {!hasCompressedImage ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm font-semibold text-slate-600 transition-colors hover:border-sky-400 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {phase === 'compressing' ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Comprimiendo…
              </>
            ) : (
              <>
                <Camera size={18} /> Tomar foto / elegir archivo
              </>
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {previewObjectUrl && (
                <img
                  src={previewObjectUrl}
                  alt="Vista previa de la receta"
                  className="block max-h-72 w-full object-contain bg-slate-50"
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>Imagen lista para subir.</span>
              <button
                type="button"
                onClick={clearCompressedImage}
                disabled={isBusy}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
              >
                <XCircle size={12} /> Cambiar
              </button>
            </div>
          </div>
        )}
      </fieldset>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={submitDisabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {phase === 'uploading' ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Subiendo…
          </>
        ) : (
          <>
            <Upload size={16} /> Subir receta
          </>
        )}
      </button>
    </form>
  );
};

export { formatBytes as __formatBytesForTesting };
