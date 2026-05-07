import React, { useCallback, useState } from 'react';
import { ArrowLeft, Filter, Grid3x3, Inbox, List, Search, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { executeReassignPrescriptionPatient } from '@/application/prescriptions/reassignPrescriptionPatientUseCase';
import { executeDeletePrescription } from '@/application/prescriptions/deletePrescriptionUseCase';
import { executeUpdatePrescriptionType } from '@/application/prescriptions/updatePrescriptionTypeUseCase';
import {
  PRESCRIPTION_TYPE_LABELS,
  type PrescriptionRecord,
  type PrescriptionType,
} from '@/types/prescriptionTypes';
import { usePrescriptionListController } from '@/features/prescriptions/hooks/usePrescriptionListController';
import { PrescriptionListItem } from '@/features/prescriptions/components/PrescriptionListItem';
import { PrescriptionDetailModal } from '@/features/prescriptions/components/PrescriptionDetailModal';
import { PrescriptionDateStrip } from '@/features/prescriptions/components/PrescriptionDateStrip';
import { PrescriptionBedGridView } from '@/features/prescriptions/components/PrescriptionBedGridView';

type VisorMode = 'list' | 'bed-grid';

export const PrescriptionVisorView: React.FC = () => {
  const auth = useAuth();
  const controller = usePrescriptionListController();
  const [selected, setSelected] = useState<PrescriptionRecord | null>(null);
  const [mode, setMode] = useState<VisorMode>('bed-grid');

  const canEdit = auth.role === 'admin' || auth.role === 'nurse_hospital' || auth.isEditor;
  const canDelete = auth.role === 'admin' || auth.role === 'nurse_hospital';

  const handleReassign = useCallback(
    async (patch: {
      bedId?: string;
      patientName?: string;
      patientRut?: string;
      clear: boolean;
    }) => {
      if (!selected) return;
      const reassignedBy = auth.currentUser?.email ?? auth.currentUser?.uid ?? 'desconocido';
      const updated = await executeReassignPrescriptionPatient({
        prescriptionId: selected.id,
        bedId: patch.clear ? undefined : patch.bedId,
        patientName: patch.clear ? undefined : patch.patientName,
        patientRut: patch.clear ? undefined : patch.patientRut,
        reassignedBy,
      });
      setSelected(updated);
    },
    [auth.currentUser, selected]
  );

  const handleUpdateType = useCallback(
    async (nextType: PrescriptionType) => {
      if (!selected) return;
      const updatedBy = auth.currentUser?.email ?? auth.currentUser?.uid ?? 'desconocido';
      const updated = await executeUpdatePrescriptionType({
        prescriptionId: selected.id,
        prescriptionType: nextType,
        updatedBy,
      });
      setSelected(updated);
    },
    [auth.currentUser, selected]
  );

  const handleGridAssign = useCallback(
    async (
      record: PrescriptionRecord,
      target: { bedId: string; patientName: string; patientRut: string }
    ) => {
      const reassignedBy = auth.currentUser?.email ?? auth.currentUser?.uid ?? 'desconocido';
      await executeReassignPrescriptionPatient({
        prescriptionId: record.id,
        bedId: target.bedId,
        patientName: target.patientName || undefined,
        patientRut: target.patientRut || undefined,
        reassignedBy,
      });
    },
    [auth.currentUser]
  );

  const handleGridUpdateType = useCallback(
    async (record: PrescriptionRecord, nextType: PrescriptionType) => {
      const updatedBy = auth.currentUser?.email ?? auth.currentUser?.uid ?? 'desconocido';
      await executeUpdatePrescriptionType({
        prescriptionId: record.id,
        prescriptionType: nextType,
        updatedBy,
      });
    },
    [auth.currentUser]
  );

  const handleGridDelete = useCallback(
    async (record: PrescriptionRecord) => {
      const deletedBy = auth.currentUser?.email ?? auth.currentUser?.uid ?? 'anon';
      await executeDeletePrescription({ prescriptionId: record.id, deletedBy });
    },
    [auth.currentUser]
  );

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    const deletedBy = auth.currentUser?.email ?? auth.currentUser?.uid ?? 'anon';
    await executeDeletePrescription({ prescriptionId: selected.id, deletedBy });
  }, [auth.currentUser, selected]);

  return (
    <main
      data-module="prescriptions-visor"
      className="min-h-screen bg-slate-100 px-3 py-4 sm:px-4 sm:py-6 print:bg-white"
    >
      <div className="mx-auto max-w-3xl space-y-3 sm:space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a
              href="/"
              className="mb-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <ArrowLeft size={14} /> Volver al censo diario
            </a>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Hospitalizados · Recetas
            </p>
            <h1 className="text-lg font-bold text-slate-800 sm:text-xl">Visor de respaldos</h1>
            <p className="text-xs text-slate-500">
              {controller.totalCount === 0
                ? 'Aún no hay recetas registradas.'
                : `${controller.filteredRecords.length} de ${controller.totalCount} receta(s)`}
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Modo de vista"
            className="inline-flex self-start rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm sm:self-auto"
          >
            <button
              role="tab"
              type="button"
              aria-selected={mode === 'list'}
              onClick={() => setMode('list')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <List size={14} /> Lista
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={mode === 'bed-grid'}
              onClick={() => setMode('bed-grid')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'bed-grid'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Grid3x3 size={14} /> Por cama
            </button>
          </div>
        </header>

        <PrescriptionDateStrip
          selectedDate={controller.filters.selectedDate}
          onSelectDate={isoDate => controller.setFilter('selectedDate', isoDate)}
          records={controller.records}
        />

        <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Search size={14} className="text-slate-400" />
              <input
                type="search"
                value={controller.filters.search}
                onChange={event => controller.setFilter('search', event.target.value)}
                placeholder="Buscar por cama, paciente, nombre…"
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <Filter size={14} className="text-slate-400" />
              <select
                value={controller.filters.type}
                onChange={event =>
                  controller.setFilter('type', event.target.value as typeof controller.filters.type)
                }
                className="flex-1 bg-transparent text-sm focus:outline-none"
              >
                <option value="all">Todos los tipos</option>
                {controller.prescriptionTypes.map(type => (
                  <option key={type} value={type}>
                    {PRESCRIPTION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <Filter size={14} className="text-slate-400" />
              <select
                value={controller.filters.patient}
                onChange={event =>
                  controller.setFilter(
                    'patient',
                    event.target.value as typeof controller.filters.patient
                  )
                }
                className="flex-1 bg-transparent text-sm focus:outline-none"
              >
                <option value="all">Todos los pacientes</option>
                <option value="assigned">Con paciente asignado</option>
                <option value="unassigned">Sin paciente asignado</option>
              </select>
            </label>
          </div>

          {(controller.filters.search ||
            controller.filters.type !== 'all' ||
            controller.filters.patient !== 'all' ||
            controller.filters.selectedDate !== null) && (
            <button
              type="button"
              onClick={controller.resetFilters}
              className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <X size={12} /> Limpiar filtros
            </button>
          )}
        </section>

        {mode === 'list' ? (
          <section className="space-y-2">
            {controller.phase === 'loading' ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                Cargando respaldos…
              </p>
            ) : controller.filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                <Inbox size={28} className="text-slate-300" />
                {controller.totalCount === 0
                  ? 'Todavía no hay recetas en el respaldo.'
                  : 'Ninguna receta coincide con los filtros.'}
              </div>
            ) : (
              controller.filteredRecords.map(record => (
                <PrescriptionListItem key={record.id} record={record} onSelect={setSelected} />
              ))
            )}
          </section>
        ) : (
          <PrescriptionBedGridView
            records={controller.filteredRecords}
            dayIso={controller.filters.selectedDate}
            onAssign={canEdit ? handleGridAssign : undefined}
            onUpdateType={canEdit ? handleGridUpdateType : undefined}
            onDelete={canDelete ? handleGridDelete : undefined}
          />
        )}
      </div>

      {selected && (
        <PrescriptionDetailModal
          record={selected}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setSelected(null)}
          onReassign={handleReassign}
          onDelete={handleDelete}
          onUpdateType={handleUpdateType}
          selectedDate={controller.filters.selectedDate}
        />
      )}
    </main>
  );
};

export default PrescriptionVisorView;
