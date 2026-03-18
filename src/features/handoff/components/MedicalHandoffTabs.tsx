import React, { useState } from 'react';
import { BedDefinition } from '@/types/domain/base';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { HandoffPatientTable } from './HandoffPatientTable';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import type { HandoffClinicalEventActions, HandoffMedicalActions } from './handoffRowContracts';
import {
  buildMedicalPrintSectionModel,
  countScopedPatients,
  hasNamedPatientsInBeds,
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
  clinicalEventActions?: HandoffClinicalEventActions;
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
  clinicalEventActions,
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
  const hasDisplayPatients = hasAnyPatients ?? hasNamedPatientsInBeds(displayBeds, record);

  const handlePrint = (mode: MedicalPrintMode) => {
    setPrintMode(mode);
    setTimeout(() => window.print(), 100);
  };
  const printBeds = resolveMedicalPrintBeds({ printMode, upcBeds, nonUpcBeds });
  const upcPrintSection = buildMedicalPrintSectionModel('upc', printBeds.upc, record);
  const nonUpcPrintSection = buildMedicalPrintSectionModel('no-upc', printBeds.nonUpc, record);

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
          clinicalEventActions={clinicalEventActions}
          tableHeaderClass={tableHeaderClass}
          readOnly={readOnly}
          isMedical={isMedical}
          hasAnyPatients={hasDisplayPatients}
          shouldShowPatient={shouldShowPatient}
        />
      </div>

      <div className="hidden print:block space-y-4">
        {upcPrintSection.beds.length > 0 && upcPrintSection.hasPatients && (
          <div>
            <h3 className="text-xs font-bold text-red-700 bg-red-50 px-3 py-1 border border-red-200 border-b-0 rounded-t-lg">
              {upcPrintSection.title}
            </h3>
            <HandoffPatientTable
              visibleBeds={upcPrintSection.beds}
              record={record}
              noteField={noteField}
              onNoteChange={onNoteChange}
              medicalActions={medicalActions}
              clinicalEventActions={clinicalEventActions}
              tableHeaderClass={tableHeaderClass}
              readOnly={readOnly}
              isMedical={isMedical}
              hasAnyPatients={true}
              shouldShowPatient={shouldShowPatient}
            />
          </div>
        )}

        {nonUpcPrintSection.beds.length > 0 && nonUpcPrintSection.hasPatients && (
          <div>
            <h3 className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 border border-slate-200 border-b-0 rounded-t-lg">
              {nonUpcPrintSection.title}
            </h3>
            <HandoffPatientTable
              visibleBeds={nonUpcPrintSection.beds}
              record={record}
              noteField={noteField}
              onNoteChange={onNoteChange}
              medicalActions={medicalActions}
              clinicalEventActions={clinicalEventActions}
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
