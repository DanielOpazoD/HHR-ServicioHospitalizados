import React from 'react';
import type { BedDefinition, DailyRecord, Specialty } from '@/types';
import type { MedicalHandoffScope } from '@/features/handoff/controllers';
import type { HandoffClinicalEventActions, HandoffMedicalActions } from './handoffRowContracts';
import {
  defaultBrowserWindowRuntime,
  writeClipboardText,
} from '@/shared/runtime/browserWindowRuntime';
import { MedicalHandoffHeader } from './MedicalHandoffHeader';
import { MedicalHandoffTabs } from './MedicalHandoffTabs';
import {
  buildMedicalSpecialistAccessLink,
  buildMedicalSpecialtyLink,
  type MedicalHandoffScope as ScopeType,
} from '@/features/handoff/controllers';

interface HandoffMedicalContentProps {
  record: DailyRecord;
  effectiveVisibleBeds: BedDefinition[];
  specialtyFilteredBeds: BedDefinition[];
  readOnly: boolean;
  role?: string;
  specialistAccess?: boolean;
  canCopySpecialistLink: boolean;
  scopedMedicalSignature: { doctorName: string; signedAt: string } | null;
  scopedMedicalHandoffSentAt: string | null;
  showDeliverySection: boolean;
  canEditDoctorName: boolean;
  canSignMedicalHandoff: boolean;
  updateMedicalHandoffDoctor?: (doctorName: string) => Promise<void>;
  markMedicalHandoffAsSent?: (doctorName?: string, scope?: ScopeType) => Promise<void>;
  resetMedicalHandoffState?: () => Promise<void>;
  selectedMedicalSpecialty: Specialty | 'all';
  setSelectedMedicalSpecialty: (specialty: Specialty | 'all') => void;
  medicalSpecialties: Specialty[];
  success: (message: string, description?: string) => void;
  noteField: 'handoffNoteDayShift' | 'handoffNoteNightShift' | 'medicalHandoffNote';
  onNoteChange: (bedId: string, value: string, isNested: boolean) => void;
  medicalActions: HandoffMedicalActions;
  clinicalEventActions: HandoffClinicalEventActions;
  tableHeaderClass: string;
  shouldShowPatient: (bedId: string) => boolean;
  scopedMedicalScope: MedicalHandoffScope;
  hasAnyVisiblePatients: boolean;
}

export const HandoffMedicalContent: React.FC<HandoffMedicalContentProps> = ({
  record,
  effectiveVisibleBeds,
  specialtyFilteredBeds,
  readOnly,
  role: _role,
  specialistAccess = false,
  canCopySpecialistLink,
  scopedMedicalSignature,
  scopedMedicalHandoffSentAt,
  showDeliverySection,
  canEditDoctorName,
  canSignMedicalHandoff,
  updateMedicalHandoffDoctor,
  markMedicalHandoffAsSent,
  resetMedicalHandoffState,
  selectedMedicalSpecialty,
  setSelectedMedicalSpecialty,
  medicalSpecialties,
  success,
  noteField,
  onNoteChange,
  medicalActions,
  clinicalEventActions,
  tableHeaderClass,
  shouldShowPatient,
  scopedMedicalScope,
  hasAnyVisiblePatients,
}) => (
  <div className="space-y-3">
    <MedicalHandoffHeader
      record={{
        ...record,
        medicalSignature: scopedMedicalSignature || undefined,
        medicalHandoffSentAt: scopedMedicalHandoffSentAt || undefined,
      }}
      visibleBeds={effectiveVisibleBeds}
      readOnly={readOnly}
      canRestoreSignatures={Boolean(resetMedicalHandoffState)}
      showDeliverySection={showDeliverySection}
      canEditDoctorName={canEditDoctorName}
      canSignMedicalHandoff={canSignMedicalHandoff}
      updateMedicalHandoffDoctor={updateMedicalHandoffDoctor}
      markMedicalHandoffAsSent={markMedicalHandoffAsSent}
      resetMedicalHandoffState={resetMedicalHandoffState}
    />

    <div className="bg-white rounded-xl border border-sky-100 p-3 print:hidden">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Especialidad</div>
        {canCopySpecialistLink ? (
          <button
            type="button"
            onClick={async () => {
              const origin = defaultBrowserWindowRuntime.getLocationOrigin();
              const pathname = defaultBrowserWindowRuntime.getLocationPathname();
              const url = specialistAccess
                ? buildMedicalSpecialtyLink(origin, pathname, record.date, selectedMedicalSpecialty)
                : buildMedicalSpecialistAccessLink(
                    origin,
                    pathname,
                    record.date,
                    scopedMedicalScope,
                    selectedMedicalSpecialty
                  );
              await writeClipboardText(url);
              success('Link copiado', 'Comparte este enlace con el especialista autorizado.');
            }}
            className="rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-200 transition-colors"
          >
            Copiar link especialista
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedMedicalSpecialty('all')}
          className={
            selectedMedicalSpecialty === 'all'
              ? 'px-3 py-2 rounded-lg bg-sky-100 text-sky-800 text-sm font-semibold'
              : 'px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium'
          }
        >
          Todos
        </button>
        {medicalSpecialties.map(specialty => (
          <button
            key={specialty}
            type="button"
            onClick={() => setSelectedMedicalSpecialty(specialty)}
            className={
              selectedMedicalSpecialty === specialty
                ? 'px-3 py-2 rounded-lg bg-sky-100 text-sky-800 text-sm font-semibold'
                : 'px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium'
            }
          >
            {specialty}
          </button>
        ))}
      </div>
    </div>

    <MedicalHandoffTabs
      visibleBeds={specialtyFilteredBeds}
      record={record}
      noteField={noteField}
      onNoteChange={onNoteChange}
      medicalActions={medicalActions}
      clinicalEventActions={clinicalEventActions}
      tableHeaderClass={tableHeaderClass}
      readOnly={readOnly}
      isMedical={true}
      shouldShowPatient={shouldShowPatient}
      fixedScope={scopedMedicalScope === 'all' ? null : scopedMedicalScope}
      hasAnyPatients={hasAnyVisiblePatients}
    />
  </div>
);
