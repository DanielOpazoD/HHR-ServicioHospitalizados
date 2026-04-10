import React from 'react';
import { Activity, ClipboardList, Printer, Stethoscope, UserRound } from 'lucide-react';
import { BaseModal } from '@/components/shared/BaseModal';
import {
  formatMedicalIndicationsDate,
  type MedicalIndicationsPatientOption,
} from '@/shared/contracts/medicalIndications';
import { MedicalIndicationsListSection } from './MedicalIndicationsListSection';
import { useMedicalIndicationsEditor } from './useMedicalIndicationsEditor';

const loadPrintMedicalIndicationsPdf = async () =>
  import('@/services/pdf/medicalIndicationsPdfService').then(
    module => module.printMedicalIndicationsPdf
  );

interface MedicalIndicationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  patients: MedicalIndicationsPatientOption[];
}

const buildToday = () => {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export const MedicalIndicationsDialog: React.FC<MedicalIndicationsDialogProps> = ({
  isOpen,
  onClose,
  patients,
}) => {
  const editor = useMedicalIndicationsEditor({ isOpen, patients });

  if (patients.length === 0) {
    return null;
  }

  const handlePrint = async () => {
    if (!editor.selectedPatient || editor.isPrinting) return;

    editor.setIsPrinting(true);
    try {
      const printMedicalIndicationsPdf = await loadPrintMedicalIndicationsPdf();
      await printMedicalIndicationsPdf({
        paciente_nombre: editor.selectedPatient.patientName,
        paciente_rut: editor.selectedPatient.rut,
        paciente_diagnostico: editor.selectedPatient.diagnosis,
        paciente_edad: editor.selectedPatient.age,
        fecha_nacimiento: formatMedicalIndicationsDate(editor.selectedPatient.birthDate),
        paciente_alergias: editor.selectedPatient.allergies,
        medicotratante: editor.treatingDoctor,
        fecha_ingreso: formatMedicalIndicationsDate(editor.selectedPatient.admissionDate),
        fecha_actual: buildToday(),
        diasEstada: editor.selectedPatient.daysOfStay,
        Reposoindicacion: editor.reposo,
        Regimenindicacion: editor.regimen,
        Kinemotora: editor.kineType === 'motora' || editor.kineType === 'ambas' ? 'X' : '',
        Kinerespiratoria:
          editor.kineType === 'respiratoria' || editor.kineType === 'ambas' ? 'X' : '',
        Kinecantidadvecesdia: editor.kineTimes,
        Pendientes: editor.pendingNotes,
        indicaciones: editor.indications,
      });
    } finally {
      editor.setIsPrinting(false);
    }
  };

  const remainingSlots = editor.maxIndications - editor.activeIndications.length;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-medical-500 to-medical-700 text-white shadow-md shadow-medical-500/20">
            <ClipboardList size={16} />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold tracking-tight text-slate-800">
              Indicaciones Médicas
            </span>
            {editor.selectedPatient && (
              <span className="text-[11px] font-medium text-slate-400">
                {editor.selectedPatient.patientName}
              </span>
            )}
          </span>
        </span>
      }
      size="3xl"
      variant="white"
      className="max-w-[78vw] !rounded-2xl ring-1 ring-black/[0.03]"
      bodyClassName="max-h-[84vh] overflow-y-auto px-5 py-4"
      headerActions={
        patients.length > 1 ? (
          <select
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/10"
            value={editor.selectedPatient?.bedId || editor.selectedBedId}
            onChange={event => editor.setSelectedBedId(event.target.value)}
            aria-label="Seleccionar paciente"
          >
            {patients.map(patient => (
              <option key={patient.bedId} value={patient.bedId}>
                {patient.label}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {/* Patient banner */}
      {editor.selectedPatient && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-medical-100 bg-gradient-to-r from-medical-50/80 via-medical-50/40 to-transparent px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-medical-100 text-medical-600">
            <UserRound size={16} />
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
            <span className="font-semibold text-slate-700">
              {editor.selectedPatient.patientName}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">{editor.selectedPatient.rut}</span>
            {editor.selectedPatient.diagnosis && (
              <>
                <span className="text-slate-400">|</span>
                <span
                  className="max-w-[200px] truncate text-slate-500"
                  title={editor.selectedPatient.diagnosis}
                >
                  {editor.selectedPatient.diagnosis}
                </span>
              </>
            )}
            {editor.selectedPatient.daysOfStay && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-medical-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-medical-700">
                {editor.selectedPatient.daysOfStay} días
              </span>
            )}
          </div>
        </div>
      )}

      {/* Compact metadata fields */}
      <div className="mb-3 grid grid-cols-3 gap-x-2.5 gap-y-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <div className="group relative">
          <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Reposo
          </label>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 shadow-sm transition-all placeholder:text-slate-300 focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/10"
            value={editor.reposo}
            onChange={event => editor.setReposo(event.target.value)}
            placeholder="Ej: absoluto"
          />
        </div>

        <div className="group relative">
          <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Régimen
          </label>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 shadow-sm transition-all placeholder:text-slate-300 focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/10"
            value={editor.regimen}
            onChange={event => editor.setRegimen(event.target.value)}
            placeholder="Ej: liviano"
          />
        </div>

        <div className="group relative">
          <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Pendientes
          </label>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 shadow-sm transition-all placeholder:text-slate-300 focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/10"
            value={editor.pendingNotes}
            onChange={event => editor.setPendingNotes(event.target.value)}
          />
        </div>

        <div className="group relative">
          <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <Activity size={10} className="text-slate-300" />
            Kinesiología
          </label>
          <select
            className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 shadow-sm transition-all focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/10"
            value={editor.kineType}
            onChange={event =>
              editor.setKineType(
                event.target.value as 'motora' | 'respiratoria' | 'ambas' | 'ninguna'
              )
            }
          >
            <option value="ninguna">Sin indicación</option>
            <option value="motora">Motora</option>
            <option value="respiratoria">Respiratoria</option>
            <option value="ambas">Motora y respiratoria</option>
          </select>
        </div>

        <div className="group relative">
          <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <Stethoscope size={10} className="text-slate-300" />
            Frecuencia
          </label>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 shadow-sm transition-all placeholder:text-slate-300 focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/10"
            value={editor.kineTimes}
            onChange={event => editor.setKineTimes(event.target.value)}
            placeholder="Ej: 2 veces/día"
          />
        </div>
      </div>

      {/* Indications list - primary content */}
      <MedicalIndicationsListSection
        remainingSlots={remainingSlots}
        activeIndications={editor.activeIndications}
        maxIndications={editor.maxIndications}
        isOrderingIndications={editor.isOrderingIndications}
        setIsOrderingIndications={editor.setIsOrderingIndications}
        isEditingIndications={editor.isEditingIndications}
        setIsEditingIndications={editor.setIsEditingIndications}
        resetEditing={editor.resetEditing}
        indicationDraft={editor.indicationDraft}
        setIndicationDraft={editor.setIndicationDraft}
        addIndication={editor.addIndication}
        editingIndex={editor.editingIndex}
        editingValue={editor.editingValue}
        setEditingValue={editor.setEditingValue}
        saveEditedIndication={editor.saveEditedIndication}
        startEditing={editor.startEditing}
        removeIndication={editor.removeIndication}
        moveIndication={editor.moveIndication}
      />

      {/* Footer — Doctor + actions in one row */}
      <div className="mt-3 flex items-center gap-2.5">
        <label className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <UserRound size={10} className="text-slate-300" />
          Médico tratante
        </label>
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 shadow-sm transition-all placeholder:text-slate-300 focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/10"
          value={editor.treatingDoctor}
          onChange={event => editor.setTreatingDoctor(event.target.value)}
        />
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:text-slate-700 active:scale-[0.98]"
          >
            Cerrar
          </button>
          <button
            onClick={() => void handlePrint()}
            disabled={editor.isPrinting || !editor.selectedPatient}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-medical-500 to-medical-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-md shadow-medical-600/25 transition-all hover:from-medical-600 hover:to-medical-700 hover:shadow-lg hover:shadow-medical-600/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
          >
            <Printer size={13} />
            {editor.isPrinting ? 'Generando...' : 'Imprimir PDF'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
