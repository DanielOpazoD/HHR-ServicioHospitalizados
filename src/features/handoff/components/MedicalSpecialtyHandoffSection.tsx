import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Clock3, LockKeyhole, Stethoscope } from 'lucide-react';
import type { AuthUser } from '@/types/auth';
import type {
  DailyRecord,
  MedicalHandoffActor,
  MedicalSpecialty,
} from '@/types/domain/dailyRecord';
import { DebouncedTextarea } from '@/components/ui/DebouncedTextarea';
import {
  buildMedicalSpecialtyActor,
  buildPrintableMedicalSpecialtyBlocks,
  canConfirmMedicalSpecialtyNoChanges,
  DEFAULT_NO_CHANGES_COMMENT,
  getMedicalSpecialtyLabel,
  getMedicalSpecialtyNote,
  hasMedicalSpecialtyStructuredData,
  MEDICAL_SPECIALTY_ORDER,
  resolveActiveMedicalSpecialty,
  resolveMedicalSpecialtyContinuityDraft,
  resolveMedicalSpecialtyDailyStatus,
} from '@/features/handoff/controllers/medicalSpecialtyHandoffController';
import {
  formatHandoffDateTime,
  getMedicalSpecialtyContinuityHint,
  getMedicalSpecialtyStatusLabel,
} from '@/shared/handoff/handoffPresentation';

interface MedicalSpecialtyHandoffSectionProps {
  record: DailyRecord;
  readOnly: boolean;
  role?: string;
  user: AuthUser | null;
  editableSpecialties: MedicalSpecialty[];
  onUpdateMedicalSpecialtyNote: (
    specialty: MedicalSpecialty,
    value: string,
    actor: Partial<MedicalHandoffActor>
  ) => Promise<void>;
  onConfirmMedicalSpecialtyNoChanges: (input: {
    specialty: MedicalSpecialty;
    actor: Partial<MedicalHandoffActor>;
    comment?: string;
    dateKey?: string;
  }) => Promise<void>;
}

const STATUS_STYLES = {
  updated_by_specialist: {
    label: getMedicalSpecialtyStatusLabel('updated_by_specialist'),
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  confirmed_no_changes: {
    label: getMedicalSpecialtyStatusLabel('confirmed_no_changes'),
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Clock3,
  },
  pending: {
    label: getMedicalSpecialtyStatusLabel('pending'),
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: AlertTriangle,
  },
} as const;

export const MedicalSpecialtyHandoffSection: React.FC<MedicalSpecialtyHandoffSectionProps> = ({
  record,
  readOnly,
  role,
  user,
  editableSpecialties,
  onUpdateMedicalSpecialtyNote,
  onConfirmMedicalSpecialtyNoChanges,
}) => {
  const [activeSpecialty, setActiveSpecialty] = useState<MedicalSpecialty>(
    editableSpecialties[0] || MEDICAL_SPECIALTY_ORDER[0]
  );
  const [continuityDrafts, setContinuityDrafts] = useState<
    Partial<Record<MedicalSpecialty, string>>
  >({});

  const resolvedActiveSpecialty = resolveActiveMedicalSpecialty({
    activeSpecialty,
    editableSpecialties,
  });

  const actor = useMemo(() => buildMedicalSpecialtyActor(user, role), [role, user]);
  const canConfirmToday = canConfirmMedicalSpecialtyNoChanges(role) && !readOnly;

  const activeNote = getMedicalSpecialtyNote(record, resolvedActiveSpecialty);
  const activeStatus = resolveMedicalSpecialtyDailyStatus(activeNote, record.date);
  const activeContinuity = activeNote?.dailyContinuity?.[record.date];
  const canEditActiveSpecialty = !readOnly && editableSpecialties.includes(resolvedActiveSpecialty);
  const activeStatusMeta = STATUS_STYLES[activeStatus];
  const ActiveStatusIcon = activeStatusMeta.icon;
  const activeContinuityDraft = resolveMedicalSpecialtyContinuityDraft({
    drafts: continuityDrafts,
    specialty: resolvedActiveSpecialty,
    note: activeNote,
    dateKey: record.date,
  });
  const hasSpecialtyData = hasMedicalSpecialtyStructuredData(record);
  const printableBlocks = buildPrintableMedicalSpecialtyBlocks(record);

  return (
    <section className="space-y-3">
      <div className="bg-white border border-sky-100 rounded-xl shadow-sm overflow-hidden print:hidden">
        <div className="border-b border-sky-100 bg-sky-50/70 px-4 py-3">
          <div className="flex items-center gap-2 text-sky-800">
            <Stethoscope size={18} />
            <h3 className="font-bold text-base">Entrega médica por especialidad</h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Cada especialidad mantiene su propia nota. Si hoy no hubo actualización médica, un
            usuario autorizado puede confirmar continuidad sin cambios.
          </p>
        </div>

        <div className="px-3 pt-3">
          <div className="flex flex-wrap gap-2">
            {MEDICAL_SPECIALTY_ORDER.map(specialty => {
              const specialtyStatus = resolveMedicalSpecialtyDailyStatus(
                getMedicalSpecialtyNote(record, specialty),
                record.date
              );
              const specialtyMeta = STATUS_STYLES[specialtyStatus];
              const SpecialtyStatusIcon = specialtyMeta.icon;
              const isEditable = editableSpecialties.includes(specialty) && !readOnly;

              return (
                <button
                  key={specialty}
                  type="button"
                  onClick={() => setActiveSpecialty(specialty)}
                  className={clsx(
                    'rounded-lg border px-3 py-2 text-left transition-colors min-w-[160px]',
                    resolvedActiveSpecialty === specialty
                      ? 'border-sky-400 bg-sky-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-800">
                      {getMedicalSpecialtyLabel(specialty)}
                    </span>
                    {!isEditable && <LockKeyhole size={12} className="text-slate-400" />}
                  </div>
                  <div
                    className={clsx(
                      'mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      specialtyMeta.className
                    )}
                  >
                    <SpecialtyStatusIcon size={12} />
                    {specialtyMeta.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 pt-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {getMedicalSpecialtyLabel(resolvedActiveSpecialty)}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>Última edición: {formatHandoffDateTime(activeNote?.updatedAt)}</span>
                <span>
                  Autor:{' '}
                  {activeNote?.author?.displayName || activeNote?.author?.email || 'sin autor'}
                </span>
                {activeContinuity?.confirmedBy && (
                  <span>
                    Confirmó hoy:{' '}
                    {activeContinuity.confirmedBy.displayName || activeContinuity.confirmedBy.email}
                  </span>
                )}
              </div>
            </div>

            <div
              className={clsx(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                activeStatusMeta.className
              )}
            >
              <ActiveStatusIcon size={14} />
              {activeStatusMeta.label}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
              Nota de la especialidad
            </label>
            <DebouncedTextarea
              value={activeNote?.note || ''}
              onChangeValue={value => {
                void onUpdateMedicalSpecialtyNote(resolvedActiveSpecialty, value, actor);
              }}
              disabled={!canEditActiveSpecialty}
              debounceMs={1200}
              placeholder={
                canEditActiveSpecialty
                  ? 'Registrar entrega del especialista...'
                  : 'Sin permiso de edición para esta especialidad.'
              }
              className={clsx(
                'w-full min-h-[140px] rounded-lg border border-slate-300 px-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500',
                !canEditActiveSpecialty && 'bg-slate-50 text-slate-500'
              )}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-700">Continuidad diaria</div>
                <div className="text-xs text-slate-500">
                  Fecha clínica: {record.date}. Solo disponible si ya existe una nota base.
                </div>
              </div>
              {activeContinuity?.confirmedAt && (
                <div className="text-xs text-slate-500">
                  {formatHandoffDateTime(activeContinuity.confirmedAt)}
                </div>
              )}
            </div>

            <textarea
              value={activeContinuityDraft}
              onChange={event =>
                setContinuityDrafts(previous => ({
                  ...previous,
                  [resolvedActiveSpecialty]: event.target.value,
                }))
              }
              disabled={!canConfirmToday || activeStatus === 'updated_by_specialist'}
              className={clsx(
                'mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400',
                (!canConfirmToday || activeStatus === 'updated_by_specialist') &&
                  'bg-slate-100 text-slate-500'
              )}
              rows={3}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {canConfirmToday
                  ? activeStatus === 'pending'
                    ? 'Usa este comentario cuando la condición permanezca sin cambios respecto a la última nota del especialista.'
                    : getMedicalSpecialtyContinuityHint(activeStatus)
                  : readOnly
                    ? 'Solo lectura para este registro.'
                    : 'Solo un usuario autorizado puede confirmar continuidad.'}
              </div>
              {canConfirmToday && (
                <button
                  type="button"
                  onClick={() =>
                    void onConfirmMedicalSpecialtyNoChanges({
                      specialty: resolvedActiveSpecialty,
                      actor,
                      comment: activeContinuityDraft,
                      dateKey: record.date,
                    })
                  }
                  disabled={activeStatus === 'updated_by_specialist'}
                  className={clsx(
                    'rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors',
                    activeStatus === 'updated_by_specialist'
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  )}
                >
                  Confirmar sin cambios hoy
                </button>
              )}
            </div>
          </div>

          {!hasSpecialtyData && record.medicalHandoffNovedades && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="font-semibold">Resumen legado</div>
              <div className="mt-1 whitespace-pre-wrap">{record.medicalHandoffNovedades}</div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden print:block space-y-3">
        {printableBlocks.map(block => (
          <div
            key={block.specialty}
            className="rounded border border-slate-300 px-3 py-2 text-[10px] text-slate-800"
          >
            <div className="font-bold mb-1">{block.title}</div>
            {block.content && <div className="whitespace-pre-wrap">{block.content}</div>}
            {block.continuityComment && (
              <div className="mt-2 italic">
                {block.continuityComment || DEFAULT_NO_CHANGES_COMMENT}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
