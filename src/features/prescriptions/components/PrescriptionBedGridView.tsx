import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import type { DailyRecord } from '@/services/storage/storageDailyRecordContracts';
import {
  PRESCRIPTION_TYPES,
  PRESCRIPTION_TYPE_LABELS,
  resolvePrescriptionAssignmentScope,
  type PrescriptionRecord,
  type PrescriptionType,
} from '@/types/prescriptionTypes';
import { PrescriptionPatientLightbox } from '@/features/prescriptions/components/PrescriptionPatientLightbox';
import {
  PrescriptionBedRow,
  type PrescriptionBedRowData,
} from '@/features/prescriptions/components/PrescriptionBedRow';
import { PrescriptionUnassignedTray } from '@/features/prescriptions/components/PrescriptionUnassignedTray';

export interface PrescriptionBedGridAssignTarget {
  bedId: string;
  patientName: string;
  patientRut: string;
}

interface PrescriptionBedGridViewProps {
  /** All loaded prescription records (already filtered by date if applicable). */
  records: PrescriptionRecord[];
  /** ISO yyyy-mm-dd of the day whose census should populate rows. Null = today. */
  dayIso: string | null;
  /**
   * Called when the user drops an unassigned prescription onto a bed-row +
   * matching-type cell, or clicks the inline assign action. The grid only
   * fires this for prescriptions whose `prescriptionType` matches the
   * column receiving the drop. The parent runs the reassignment use case
   * and refreshes the record list.
   */
  onAssign?: (record: PrescriptionRecord, target: PrescriptionBedGridAssignTarget) => Promise<void>;
  /**
   * Persists a new prescription type for the given record. Wired to the
   * quick-type button rendered next to every thumbnail (assigned and
   * unassigned). Omitted when the user lacks edit permission.
   */
  onUpdateType?: (record: PrescriptionRecord, nextType: PrescriptionType) => Promise<void>;
  onDelete?: (record: PrescriptionRecord) => Promise<void>;
}

const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const previousIsoDay = (iso: string): string => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatDayLabel = (iso: string): string => {
  try {
    const [year, month, day] = iso.split('-').map(Number);
    const d = new Date(year, (month ?? 1) - 1, day ?? 1);
    return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return iso;
  }
};

const isUnassignedRecord = (record: PrescriptionRecord): boolean =>
  resolvePrescriptionAssignmentScope(record) === 'unassigned';

const isStockRecord = (record: PrescriptionRecord): boolean =>
  resolvePrescriptionAssignmentScope(record) === 'hospitalized_stock';

const buildBedRows = (
  daily: DailyRecord | null,
  records: PrescriptionRecord[]
): PrescriptionBedRowData[] => {
  if (!daily) return [];
  const byBed = new Map<string, PrescriptionBedRowData>();

  for (const [bedId, patient] of Object.entries(daily.beds || {})) {
    if (!patient || patient.isBlocked) continue;
    const hasIdentity = Boolean(patient.patientName?.trim()) || Boolean(patient.rut?.trim());
    if (!hasIdentity) continue;
    byBed.set(bedId, {
      bedId,
      patientName: patient.patientName?.trim() ?? '',
      patientRut: patient.rut?.trim() ?? '',
      byType: {
        comun: [],
        psicotropicos: [],
        benzodiazepinas: [],
      },
    });
  }

  for (const record of records) {
    if (resolvePrescriptionAssignmentScope(record) !== 'patient') continue;
    if (!record.bedId) continue;
    const row = byBed.get(record.bedId);
    if (!row) continue;
    row.byType[record.prescriptionType].push(record);
  }

  return Array.from(byBed.values()).sort((a, b) =>
    a.bedId.localeCompare(b.bedId, 'es', { numeric: true })
  );
};

export const PrescriptionBedGridView: React.FC<PrescriptionBedGridViewProps> = ({
  records,
  dayIso,
  onAssign,
  onUpdateType,
  onDelete,
}) => {
  const effectiveDay = dayIso ?? todayIso();
  const [dailyState, setDailyState] = useState<{
    requestedDay: string;
    sourceDay: string;
    record: DailyRecord | null;
    isFallbackFromPreviousDay: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDay, setErrorDay] = useState<string | null>(null);
  const [lightboxState, setLightboxState] = useState<{
    record: PrescriptionRecord;
    initialUrl: string;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<{ bedId: string; type: PrescriptionType } | null>(
    null
  );
  const [pendingAssignId, setPendingAssignId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [pickerSource, setPickerSource] = useState<PrescriptionRecord | null>(null);

  const loading = dailyState?.requestedDay !== effectiveDay && errorDay !== effectiveDay;
  const daily = dailyState?.requestedDay === effectiveDay ? dailyState.record : null;
  const dailySourceDay =
    dailyState?.requestedDay === effectiveDay ? dailyState.sourceDay : effectiveDay;
  const isDailyFallback =
    dailyState?.requestedDay === effectiveDay && dailyState.isFallbackFromPreviousDay;
  const activeError = errorDay === effectiveDay ? error : null;

  useEffect(() => {
    let cancelled = false;
    getRecordFromFirestore(effectiveDay)
      .then(async record => {
        if (cancelled) return;
        if (buildBedRows(record, []).length > 0) {
          setDailyState({
            requestedDay: effectiveDay,
            sourceDay: effectiveDay,
            record,
            isFallbackFromPreviousDay: false,
          });
          setError(null);
          setErrorDay(null);
          return;
        }

        const fallbackDay = previousIsoDay(effectiveDay);
        const fallbackRecord = await getRecordFromFirestore(fallbackDay);
        if (cancelled) return;
        if (buildBedRows(fallbackRecord, []).length > 0) {
          setDailyState({
            requestedDay: effectiveDay,
            sourceDay: fallbackDay,
            record: fallbackRecord,
            isFallbackFromPreviousDay: true,
          });
        } else {
          setDailyState({
            requestedDay: effectiveDay,
            sourceDay: effectiveDay,
            record,
            isFallbackFromPreviousDay: false,
          });
        }
        setError(null);
        setErrorDay(null);
      })
      .catch(caught => {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : 'No se pudo cargar la base censal del día.'
        );
        setErrorDay(effectiveDay);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveDay]);

  const rows = useMemo(() => buildBedRows(daily, records), [daily, records]);

  const unassigned = useMemo(
    () =>
      records
        .filter(isUnassignedRecord)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [records]
  );

  const stockRecords = useMemo(
    () =>
      records
        .filter(isStockRecord)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [records]
  );

  const draggingRecord = useMemo(
    () => unassigned.find(record => record.id === draggingId) ?? null,
    [unassigned, draggingId]
  );

  const performAssign = async (
    record: PrescriptionRecord,
    row: PrescriptionBedRowData
  ): Promise<void> => {
    if (!onAssign) return;
    setAssignError(null);
    setPendingAssignId(record.id);
    try {
      await onAssign(record, {
        bedId: row.bedId,
        patientName: row.patientName,
        patientRut: row.patientRut,
      });
    } catch (caught) {
      setAssignError(caught instanceof Error ? caught.message : 'No se pudo asignar la receta.');
    } finally {
      setPendingAssignId(null);
      setHoverCell(null);
      setDraggingId(null);
      setPickerSource(null);
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, record: PrescriptionRecord) => {
    if (!onAssign) return;
    setDraggingId(record.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', record.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setHoverCell(null);
  };

  const handleCellDragOver = (
    event: React.DragEvent<HTMLTableCellElement>,
    type: PrescriptionType,
    bedId: string
  ) => {
    if (!onAssign || !draggingRecord) return;
    if (draggingRecord.prescriptionType !== type) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setHoverCell({ bedId, type });
  };

  const handleCellDragLeave = (type: PrescriptionType, bedId: string) => {
    setHoverCell(prev => (prev?.bedId === bedId && prev.type === type ? null : prev));
  };

  const handleCellDrop = async (
    event: React.DragEvent<HTMLTableCellElement>,
    row: PrescriptionBedRowData,
    type: PrescriptionType
  ) => {
    if (!onAssign || !draggingRecord) return;
    event.preventDefault();
    if (draggingRecord.prescriptionType !== type) {
      setHoverCell(null);
      return;
    }
    await performAssign(draggingRecord, row);
  };

  const togglePicker = (record: PrescriptionRecord) => {
    setPickerSource(prev => (prev?.id === record.id ? null : record));
  };

  const openLightbox = (record: PrescriptionRecord, url: string) => {
    setLightboxState({ record, initialUrl: url });
  };

  const closeLightbox = () => {
    setLightboxState(null);
  };

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2 px-1">
        <p className="text-[11px] text-slate-500">
          Camas hospitalizadas de{' '}
          <span className="font-semibold capitalize text-slate-700">
            {formatDayLabel(effectiveDay)}
          </span>
          . Haz click en una miniatura para ver la receta en grande.
          {isDailyFallback && (
            <span className="ml-1 text-sky-700">
              Pacientes tomados del censo del día previo ({formatDayLabel(dailySourceDay)}).
            </span>
          )}
        </p>
        {!loading && !activeError && (
          <p className="text-[11px] text-slate-400">
            {rows.length} cama(s) · {records.length} receta(s) en vista
          </p>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          <Loader2 size={16} className="mr-2 animate-spin" /> Cargando base censal…
        </div>
      ) : activeError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {activeError}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No hay pacientes activos en la base censal de este día.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] table-fixed text-sm">
            <colgroup>
              <col className="w-[64px]" />
              <col />
              {PRESCRIPTION_TYPES.map(type => (
                <col key={type} className="w-[160px]" />
              ))}
            </colgroup>
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">Cama</th>
                <th className="px-2 py-2 text-left">Paciente</th>
                {PRESCRIPTION_TYPES.map(type => (
                  <th key={type} className="px-2 py-2 text-center">
                    {PRESCRIPTION_TYPE_LABELS[type]
                      .replace('Receta de ', '')
                      .replace('Receta ', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <PrescriptionBedRow
                  key={row.bedId}
                  row={row}
                  draggingRecord={draggingRecord}
                  hoverCell={hoverCell}
                  pickerSource={pickerSource}
                  pendingAssignId={pendingAssignId}
                  enableDrop={!!onAssign}
                  onDragOver={handleCellDragOver}
                  onDragLeave={handleCellDragLeave}
                  onDrop={handleCellDrop}
                  onPickerAssign={performAssign}
                  onPreviewImage={openLightbox}
                  onUpdateType={onUpdateType}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PrescriptionUnassignedTray
        records={unassigned}
        draggingId={draggingId}
        pickerSource={pickerSource}
        assignError={assignError}
        enableAssign={!!onAssign}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onTogglePicker={togglePicker}
        onPreviewImage={openLightbox}
        onUpdateType={onUpdateType}
      />

      {stockRecords.length > 0 && (
        <PrescriptionUnassignedTray
          records={stockRecords}
          draggingId={null}
          pickerSource={null}
          assignError={null}
          enableAssign={false}
          testId="prescription-stock-tray"
          cardTestIdPrefix="prescription-stock-card"
          title="Stock de Hospitalizados"
          emptyLabel="Sin recetas en Stock de Hospitalizados."
          onDragStart={() => undefined}
          onDragEnd={() => undefined}
          onTogglePicker={() => undefined}
          onPreviewImage={openLightbox}
          onUpdateType={onUpdateType}
        />
      )}

      {lightboxState && (
        <PrescriptionPatientLightbox
          record={lightboxState.record}
          records={records}
          initialUrl={lightboxState.initialUrl}
          onClose={closeLightbox}
          onDelete={onDelete}
        />
      )}
    </section>
  );
};
