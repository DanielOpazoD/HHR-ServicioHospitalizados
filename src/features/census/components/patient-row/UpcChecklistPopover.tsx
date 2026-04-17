import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ShieldCheck } from 'lucide-react';
import { useUpcChecklistController } from './useUpcChecklistController';
import type { UpcChecklistAuditActor } from './useUpcChecklistController';
import { UpcChecklistPanel } from './UpcChecklistPanel';
import {
  resolveUpcClassificationLabel,
  resolveUpcBadgeColor,
} from '@/domain/upc/upcClassification';
import {
  resolveUpcClassificationFromChecklist,
  isUciEligibleBedId,
} from '@/shared/census/upcBedPolicy';
import type { UpcChecklistRecord } from '@/features/census/contracts/censusUpcContracts';
import type { BaseCellProps } from './inputCellTypes';
import { PatientEmptyCell } from './PatientEmptyCell';

interface UpcChecklistPopoverProps extends BaseCellProps {
  checklist: UpcChecklistRecord | undefined;
  onSave: (record: UpcChecklistRecord) => void;
  eligible: boolean;
  actor: UpcChecklistAuditActor | null;
}

export const UpcChecklistPopover: React.FC<UpcChecklistPopoverProps> = ({
  data,
  isSubRow = false,
  isEmpty = false,
  readOnly = false,
  checklist,
  onSave,
  eligible,
  actor,
}) => {
  const uciAllowed = isUciEligibleBedId(data.bedId);

  const {
    buttonRef,
    popoverRef,
    isOpen,
    popoverPos,
    togglePopover,
    closePopover,
    draftUci,
    draftUti,
    draftClassification,
    hasDraftCriteria,
    uciAllowed: controllerUciAllowed,
    toggleUciCriterion,
    toggleUtiCriterion,
    saveAndClose,
    clearAndClose,
  } = useUpcChecklistController({
    checklist,
    onSave,
    disabled: readOnly || !eligible,
    uciAllowed,
    actor,
  });

  const { label, colors } = useMemo(() => {
    const cls = resolveUpcClassificationFromChecklist(checklist);
    return {
      label: resolveUpcClassificationLabel(cls),
      colors: resolveUpcBadgeColor(cls),
    };
  }, [checklist]);

  if (isEmpty && !isSubRow) {
    return <PatientEmptyCell tdClassName="p-0.5 text-center w-14" />;
  }

  if (!eligible) {
    return (
      <td className="p-0.5 text-center w-14" title="UPC disponible solo en R1-R4, Neo 1-2">
        <span className="text-slate-300 text-[9px]">—</span>
      </td>
    );
  }

  return (
    <td className="p-0.5 text-center w-14">
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePopover}
        disabled={readOnly}
        className={clsx(
          'inline-flex items-center justify-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-bold transition-all min-w-[36px] min-h-[20px]',
          readOnly && 'cursor-default',
          label
            ? clsx('border', colors.text, colors.bg, colors.border, !readOnly && 'hover:opacity-80')
            : clsx(
                'text-slate-400 border border-dashed border-slate-200',
                !readOnly && 'hover:border-slate-400 hover:text-slate-600'
              )
        )}
        title={
          label
            ? `UPC-${label} — Click para editar criterios`
            : 'Sin clasificación UPC — Click para evaluar'
        }
      >
        {label ? label : <ShieldCheck size={11} className="text-slate-300" />}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[10000]"
            style={{ top: popoverPos.top, left: popoverPos.left }}
            onClick={e => e.stopPropagation()}
          >
            <UpcChecklistPanel
              draftUci={draftUci}
              draftUti={draftUti}
              draftClassification={draftClassification}
              hasDraftCriteria={hasDraftCriteria}
              uciAllowed={controllerUciAllowed}
              onToggleUci={toggleUciCriterion}
              onToggleUti={toggleUtiCriterion}
              onSave={saveAndClose}
              onClear={clearAndClose}
              onClose={closePopover}
            />
          </div>,
          document.body
        )}
    </td>
  );
};
