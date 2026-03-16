import React from 'react';
import { createPortal } from 'react-dom';
import { Check, Info } from 'lucide-react';
import clsx from 'clsx';
import type { MedicalHandoffEntry } from '@/types/domain/patient';
import { resolveMedicalHandoffValidityViewModel } from '@/domain/handoff/patientView';

interface HandoffInfoTooltipProps {
  label: string;
}

const HandoffInfoTooltip: React.FC<HandoffInfoTooltipProps> = ({ label }) => {
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 220;
    const centeredLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    const left = Math.max(12, Math.min(centeredLeft, window.innerWidth - tooltipWidth - 12));
    const top = rect.bottom + 8;
    setPosition({ top, left });
  }, []);

  const openTooltip = React.useCallback(() => {
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const closeTooltip = React.useCallback(() => setIsOpen(false), []);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleWindowChange = () => updatePosition();
    window.addEventListener('scroll', handleWindowChange, true);
    window.addEventListener('resize', handleWindowChange);
    return () => {
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('resize', handleWindowChange);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
        className="-translate-y-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[9px] font-bold text-slate-500"
        aria-label="Ver detalle de vigencia"
        title={label}
        tabIndex={0}
      >
        <Info size={10} />
      </span>
      {isOpen &&
        position &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[1000] w-[220px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] leading-tight text-slate-600 shadow-lg"
            style={{ top: position.top, left: position.left }}
          >
            {label}
          </div>,
          document.body
        )}
    </>
  );
};

interface MedicalHandoffValidityEntryProps {
  entry: MedicalHandoffEntry;
  reportDate: string;
  readOnly: boolean;
  onQuickAction?: (entryId: string) => void;
}

export const MedicalHandoffValidityEntry: React.FC<MedicalHandoffValidityEntryProps> = ({
  entry,
  reportDate,
  readOnly,
  onQuickAction,
}) => {
  const validity = resolveMedicalHandoffValidityViewModel(entry, reportDate);

  return (
    <div className="space-y-1">
      <div
        className={clsx(
          'flex items-start justify-between gap-1.5',
          validity.isMuted && 'text-slate-400'
        )}
      >
        <div className="min-w-0 flex-1 leading-snug">
          <span>{validity.statusLabel}</span>
          {validity.tooltipLabel && (
            <div className="hidden print:block mt-0.5 text-slate-500">{validity.tooltipLabel}</div>
          )}
        </div>
        <div className="flex items-center gap-1 pt-0.5 shrink-0 print:hidden">
          {validity.tooltipLabel && <HandoffInfoTooltip label={validity.tooltipLabel} />}
          {!readOnly && onQuickAction && (
            <button
              type="button"
              onClick={() => onQuickAction(entry.id)}
              disabled={!validity.canConfirm}
              className={clsx(
                'mt-px inline-flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors',
                !validity.canConfirm
                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                  : validity.isActiveToday
                    ? 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                    : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
              )}
              aria-label={
                validity.isActiveToday ? 'Entrega vigente' : 'Marcar entrega como vigente'
              }
              title={validity.isActiveToday ? 'Entrega vigente' : 'Marcar entrega como vigente'}
            >
              <Check size={8} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
