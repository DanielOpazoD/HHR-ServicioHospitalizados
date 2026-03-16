import React, { useState } from 'react';
import { BedDefinition } from '@/types/domain/base';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { PatientData } from '@/types/domain/patient';
import { ClinicalEvent } from '@/types/domain/clinical';
import { HandoffRow } from './HandoffRow';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { HandoffClinicalEventActions, HandoffMedicalActions } from './handoffRowContracts';

interface HandoffPatientTableProps {
  visibleBeds: BedDefinition[];
  record: DailyRecord;
  noteField: 'handoffNoteDayShift' | 'handoffNoteNightShift' | 'medicalHandoffNote';
  onNoteChange: (bedId: string, value: string, isNested: boolean) => void;
  medicalActions?: HandoffMedicalActions;
  tableHeaderClass: string;
  readOnly: boolean;
  isMedical: boolean;
  hasAnyPatients: boolean;
  shouldShowPatient: (bedId: string) => boolean;
  clinicalEventActions?: HandoffClinicalEventActions;
}

export const HandoffPatientTable: React.FC<HandoffPatientTableProps> = ({
  visibleBeds,
  record,
  noteField,
  onNoteChange,
  medicalActions,
  tableHeaderClass,
  readOnly,
  isMedical,
  hasAnyPatients,
  shouldShowPatient,
  clinicalEventActions,
}) => {
  const [allEventsExpanded, setAllEventsExpanded] = useState(false);

  const resolveRowMedicalActions = (bedId: string, isNested: boolean) => ({
    onCreatePrimaryEntry: medicalActions?.onCreatePrimaryEntry
      ? () => medicalActions.onCreatePrimaryEntry?.(bedId, isNested)
      : undefined,
    onEntryNoteChange: medicalActions?.onEntryNoteChange
      ? (entryId: string, value: string) =>
          medicalActions.onEntryNoteChange?.(bedId, entryId, value, isNested)
      : undefined,
    onEntrySpecialtyChange: medicalActions?.onEntrySpecialtyChange
      ? (entryId: string, specialty: string) =>
          medicalActions.onEntrySpecialtyChange?.(bedId, entryId, specialty, isNested)
      : undefined,
    onEntryAdd: medicalActions?.onEntryAdd
      ? () => medicalActions.onEntryAdd?.(bedId, isNested)
      : undefined,
    onEntryDelete: medicalActions?.onEntryDelete
      ? (entryId: string) => medicalActions.onEntryDelete?.(bedId, entryId, isNested)
      : undefined,
    onContinuityConfirm: medicalActions?.onContinuityConfirm
      ? (entryId: string) => medicalActions.onContinuityConfirm?.(bedId, entryId, isNested)
      : undefined,
  });

  const resolveRowClinicalEventActions = (bedId: string) => ({
    onAdd: clinicalEventActions?.onAdd
      ? (event: Omit<ClinicalEvent, 'id' | 'createdAt'>) =>
          clinicalEventActions.onAdd?.(bedId, event)
      : undefined,
    onUpdate: clinicalEventActions?.onUpdate
      ? (eventId: string, data: Partial<ClinicalEvent>) =>
          clinicalEventActions.onUpdate?.(bedId, eventId, data)
      : undefined,
    onDelete: clinicalEventActions?.onDelete
      ? (eventId: string) => clinicalEventActions.onDelete?.(bedId, eventId)
      : undefined,
  });

  const renderRow = (
    bed: BedDefinition,
    patient: PatientData,
    options: { isNested: boolean; forcedExpand?: boolean }
  ) => (
    <HandoffRow
      key={`${bed.id}-${options.isNested ? 'crib' : 'main'}`}
      bedName={bed.name}
      bedType={options.isNested ? 'Cuna' : bed.type}
      patient={patient}
      reportDate={record.date}
      isSubRow={options.isNested}
      noteField={noteField}
      onNoteChange={value => onNoteChange(bed.id, value, options.isNested)}
      medicalActions={resolveRowMedicalActions(bed.id, options.isNested)}
      readOnly={readOnly}
      isMedical={isMedical}
      forcedExpand={options.forcedExpand}
      clinicalEventActions={resolveRowClinicalEventActions(bed.id)}
    />
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none print:rounded-none print:overflow-visible">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left border-collapse print:[&_th]:p-1 print:[&_td]:p-1 print:[&_th]:text-[10px] print:[&_td]:text-[10px]">
          <thead>
            <tr className={tableHeaderClass}>
              <th className="p-2 border-r border-slate-200 w-16 print:w-[35px] print:text-[10px] print:p-1">
                Cama
              </th>
              <th
                className="p-2 border-r border-slate-200 w-44 print:w-[20%] print:text-[10px] print:p-1"
                title="Nombre, RUT, Edad, Fecha de Ingreso"
              >
                Paciente
              </th>
              <th className="p-2 border-r border-slate-200 w-[220px] print:w-[26%] print:text-[10px] print:p-1">
                <div className="flex items-center justify-between">
                  <span>Diagnóstico</span>
                  {clinicalEventActions && (
                    <button
                      onClick={() => setAllEventsExpanded(!allEventsExpanded)}
                      className="p-1 hover:bg-black/5 rounded transition-colors print:hidden flex items-center justify-center"
                      title={
                        allEventsExpanded
                          ? 'Colapsar todos los eventos'
                          : 'Expandir todos los eventos'
                      }
                    >
                      {allEventsExpanded ? (
                        <Minimize2 size={12} className="opacity-70" />
                      ) : (
                        <Maximize2 size={12} className="opacity-70" />
                      )}
                    </button>
                  )}
                </div>
              </th>
              {!isMedical && (
                <th
                  className="p-2 border-r border-slate-200 w-28 print:w-[50px] print:text-[10px] print:p-1"
                  title="Dispositivos médicos invasivos"
                >
                  DMI
                </th>
              )}
              {isMedical && (
                <th className="p-2 border-r border-slate-200 print:w-[35%] print:min-w-0 print:text-[10px] print:p-1">
                  Observaciones
                </th>
              )}
              {!isMedical && (
                <th className="p-2 print:w-[35%] print:min-w-0 print:text-[10px] print:p-1">
                  Observaciones
                </th>
              )}
              {isMedical && (
                <th className="p-2 w-40 print:w-[14%] print:text-[10px] print:p-1">Vigencia</th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleBeds.map(bed => {
              const patient = record.beds[bed.id];

              if (!patient) {
                return renderRow(bed, { isBlocked: false } as PatientData, { isNested: false });
              }

              if (isMedical && patient.isBlocked) {
                return null;
              }

              const showPatient =
                patient.isBlocked || !patient.patientName || shouldShowPatient(bed.id);

              if (!showPatient) {
                return renderRow(bed, { isBlocked: false } as PatientData, { isNested: false });
              }

              return (
                <React.Fragment key={bed.id}>
                  {renderRow(bed, patient, { isNested: false, forcedExpand: allEventsExpanded })}
                  {patient.clinicalCrib && patient.clinicalCrib.patientName
                    ? renderRow(bed, patient.clinicalCrib, {
                        isNested: true,
                        forcedExpand: allEventsExpanded,
                      })
                    : null}
                </React.Fragment>
              );
            })}

            {!hasAnyPatients && (
              <tr>
                <td
                  colSpan={isMedical ? 5 : 5}
                  className="p-8 text-center text-slate-400 italic text-sm"
                >
                  No hay pacientes registrados en este turno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
