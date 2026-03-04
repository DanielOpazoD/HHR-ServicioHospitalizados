import React, { useState } from 'react';
import { BedDefinition, DailyRecord } from '@/types';
import { HandoffPatientTable } from './HandoffPatientTable';
import type { MedicalHandoffScope } from '@/features/handoff/controllers';
import type { HandoffMedicalActions } from './handoffRowContracts';
import {
  countScopedPatients,
  resolveMedicalDisplayBeds,
  resolveMedicalPrintBeds,
  splitMedicalBedsByScope,
  type MedicalPrintMode,
  type MedicalTabMode,
} from '@/features/handoff/controllers/medicalHandoffTabsController';
import { MedicalHandoffTabSwitcher } from './MedicalHandoffTabSwitcher';
import { MedicalHandoffPrintMenu } from './MedicalHandoffPrintMenu';

interface MedicalHandoffTabsProps {
  visibleBeds: BedDefinition[];
  record: DailyRecord;
  noteField: 'handoffNoteDayShift' | 'handoffNoteNightShift' | 'medicalHandoffNote';
  onNoteChange: (bedId: string, value: string, isNested: boolean) => void;
  medicalActions?: HandoffMedicalActions;
  tableHeaderClass: string;
  readOnly: boolean;
  isMedical: boolean;
  shouldShowPatient: (bedId: string) => boolean;
  fixedScope?: MedicalHandoffScope | null;
  hasAnyPatients?: boolean;
}

export const MedicalHandoffTabs: React.FC<MedicalHandoffTabsProps> = ({
  visibleBeds,
  record,
  noteField,
  onNoteChange,
  medicalActions,
  tableHeaderClass,
  readOnly,
  isMedical,
  shouldShowPatient,
  fixedScope = null,
  hasAnyPatients,
}) => {
  const [activeTab, setActiveTab] = useState<MedicalTabMode>('all');
  const [printMode, setPrintMode] = useState<MedicalPrintMode>('all');
  const { upcBeds, nonUpcBeds } = splitMedicalBedsByScope(visibleBeds, record);
  const upcPatientCount = countScopedPatients(upcBeds, record);
  const nonUpcPatientCount = countScopedPatients(nonUpcBeds, record);
  const displayBeds = resolveMedicalDisplayBeds({
    visibleBeds,
    upcBeds,
    nonUpcBeds,
    activeTab,
    fixedScope,
  });
  const hasDisplayPatients =
    hasAnyPatients ?? displayBeds.some(b => record.beds[b.id]?.patientName);

  const handlePrint = (mode: MedicalPrintMode) => {
    setPrintMode(mode);
    setTimeout(() => window.print(), 100);
  };
  const printBeds = resolveMedicalPrintBeds({ printMode, upcBeds, nonUpcBeds });

  return (
    <div className="space-y-3">
      {!fixedScope && (
        <div className="flex items-center justify-between print:hidden">
          <MedicalHandoffTabSwitcher
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            upcPatientCount={upcPatientCount}
            nonUpcPatientCount={nonUpcPatientCount}
          />
          <MedicalHandoffPrintMenu
            upcPatientCount={upcPatientCount}
            nonUpcPatientCount={nonUpcPatientCount}
            onPrint={handlePrint}
          />
        </div>
      )}

      <div className="print:hidden">
        <HandoffPatientTable
          visibleBeds={displayBeds}
          record={record}
          noteField={noteField}
          onNoteChange={onNoteChange}
          medicalActions={medicalActions}
          tableHeaderClass={tableHeaderClass}
          readOnly={readOnly}
          isMedical={isMedical}
          hasAnyPatients={hasDisplayPatients}
          shouldShowPatient={shouldShowPatient}
        />
      </div>

      <div className="hidden print:block space-y-4">
        {printBeds.upc.length > 0 && printBeds.upc.some(b => record.beds[b.id]?.patientName) && (
          <div>
            <h3 className="text-xs font-bold text-red-700 bg-red-50 px-3 py-1 border border-red-200 border-b-0 rounded-t-lg">
              🔴 PACIENTES UPC ({printBeds.upc.filter(b => record.beds[b.id]?.patientName).length})
            </h3>
            <HandoffPatientTable
              visibleBeds={printBeds.upc}
              record={record}
              noteField={noteField}
              onNoteChange={onNoteChange}
              medicalActions={medicalActions}
              tableHeaderClass={tableHeaderClass}
              readOnly={readOnly}
              isMedical={isMedical}
              hasAnyPatients={true}
              shouldShowPatient={shouldShowPatient}
            />
          </div>
        )}

        {printBeds.nonUpc.length > 0 &&
          printBeds.nonUpc.some(b => record.beds[b.id]?.patientName) && (
            <div>
              <h3 className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 border border-slate-200 border-b-0 rounded-t-lg">
                🟢 PACIENTES NO UPC (
                {printBeds.nonUpc.filter(b => record.beds[b.id]?.patientName).length})
              </h3>
              <HandoffPatientTable
                visibleBeds={printBeds.nonUpc}
                record={record}
                noteField={noteField}
                onNoteChange={onNoteChange}
                medicalActions={medicalActions}
                tableHeaderClass={tableHeaderClass}
                readOnly={readOnly}
                isMedical={isMedical}
                hasAnyPatients={true}
                shouldShowPatient={shouldShowPatient}
              />
            </div>
          )}
      </div>
    </div>
  );
};
