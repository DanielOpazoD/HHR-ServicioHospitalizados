import React, { useCallback, useRef, useState } from 'react';
import { TransferRequest, TransferStatus } from '@/types/transfers';
import { ChevronDown, Clock, MessageSquare, User, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { usePortalPopoverRuntime } from '@/hooks/usePortalPopoverRuntime';
import {
  resolveTransferStatusDropdownPosition,
  TRANSFER_STATUS_OPTIONS,
  ACCEPTED_SUB_STATES,
  isAcceptedSubState,
} from '@/features/transfers/controllers/transferStatusInteractionController';
import {
  formatTransferDateTime,
  getTransferStatusLabel,
  getTransferStatusPresentation,
  getTransferStatusShortLabel,
} from '@/shared/transfers/transferPresentation';
import { LAYER_Z_INDEX } from '@/shared/ui/layering';

const TRANSFER_STATUS_DROPDOWN_WIDTH = 520;

interface TransferStatusInteractionProps {
  transfer: TransferRequest;
  onStatusChange: (status: TransferStatus) => Promise<void>;
  onDeleteHistoryEntry?: (historyIndex: number) => Promise<void>;
}

export const TransferStatusInteraction: React.FC<TransferStatusInteractionProps> = ({
  transfer,
  onStatusChange,
  onDeleteHistoryEntry,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const config = getTransferStatusPresentation(transfer.status);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  const resolveDropdownPosition = useCallback(() => {
    if (!buttonRef.current) {
      return null;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    return resolveTransferStatusDropdownPosition({
      buttonRect: rect,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      estimatedPanelWidth: TRANSFER_STATUS_DROPDOWN_WIDTH,
    });
  }, []);

  const { position: dropdownPos, updatePosition } = usePortalPopoverRuntime({
    isOpen,
    anchorRef: buttonRef,
    popoverRef: dropdownRef,
    initialPosition: { top: 0, left: 0, dropUp: false },
    resolvePosition: resolveDropdownPosition,
    onClose: closeDropdown,
  });

  const toggleDropdown = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(previous => !previous);
  };

  const handleStatusClick = async (newStatus: TransferStatus) => {
    if (newStatus === transfer.status) return;
    await onStatusChange(newStatus);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Main Badge Button */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className={clsx(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border shadow-sm',
          config.bgColor,
          config.color,
          'hover:scale-105 active:scale-95',
          isOpen ? 'ring-2 ring-offset-1 ring-blue-400' : 'border-transparent'
        )}
      >
        <span>{config.label}</span>
        <ChevronDown size={14} className={clsx('transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown Menu - Fixed position, two-panel layout */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-200"
          style={{
            zIndex: LAYER_Z_INDEX.dropdown,
            width: TRANSFER_STATUS_DROPDOWN_WIDTH,
            top: dropdownPos.dropUp ? 'auto' : dropdownPos.top,
            bottom: dropdownPos.dropUp ? `${window.innerHeight - dropdownPos.top + 8}px` : 'auto',
            left: dropdownPos.left,
          }}
        >
          <div className="flex divide-x divide-slate-200">
            {/* Left panel — Status Options */}
            <div className="w-1/2 min-w-0">
              <div className="p-3 bg-slate-50 border-b border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={12} /> Cambiar Estado
                </h4>
              </div>
              <div className="p-2 space-y-1">
                {TRANSFER_STATUS_OPTIONS.map(status => {
                  if (isAcceptedSubState(status)) return null;

                  const optionPresentation = getTransferStatusPresentation(status);
                  const isCurrent = transfer.status === status;

                  const acceptedGroup = status === 'RECEIVED' && (
                    <div
                      key="accepted-group"
                      className="rounded-lg border border-emerald-200 bg-emerald-50/40 overflow-hidden"
                    >
                      <div className="px-2 py-1.5 text-xs font-bold text-emerald-700">
                        {isAcceptedSubState(transfer.status) && <span className="mr-1">●</span>}
                        Aceptado
                      </div>
                      <div className="pl-3 pr-1 pb-1.5 space-y-0.5">
                        {ACCEPTED_SUB_STATES.map(subStatus => {
                          const subPresentation = getTransferStatusPresentation(subStatus);
                          const isSubCurrent = transfer.status === subStatus;
                          return (
                            <button
                              key={subStatus}
                              onClick={() => handleStatusClick(subStatus)}
                              className={clsx(
                                'w-full px-2 py-1 rounded-md text-[11px] font-medium text-left transition-colors',
                                isSubCurrent
                                  ? `${subPresentation.bgColor} ${subPresentation.color} ring-1 ring-inset ring-current`
                                  : 'hover:bg-emerald-100/60 text-emerald-600'
                              )}
                            >
                              {isSubCurrent && <span className="mr-1">●</span>}
                              {getTransferStatusShortLabel(subStatus)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );

                  return (
                    <React.Fragment key={status}>
                      <button
                        onClick={() => handleStatusClick(status)}
                        className={clsx(
                          'w-full px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-colors',
                          isCurrent
                            ? `${optionPresentation.bgColor} ${optionPresentation.color} ring-1 ring-inset ring-current`
                            : 'hover:bg-slate-50 text-slate-600'
                        )}
                      >
                        {isCurrent && <span className="mr-1">●</span>}
                        {optionPresentation.label}
                      </button>
                      {acceptedGroup}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Right panel — History */}
            <div className="w-1/2 min-w-0">
              <div className="p-3 bg-slate-50 border-b border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={12} /> Historial
                </h4>
              </div>
              <div className="p-3 space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                {transfer.statusHistory.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">Sin historial</p>
                ) : (
                  transfer.statusHistory
                    .slice()
                    .reverse()
                    .map((change, idx) => (
                      <div key={idx} className="relative pl-4 border-l-2 border-slate-200 py-0.5">
                        <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300 border border-white" />
                        <div className="flex justify-between items-start gap-1">
                          <p className="text-[11px] font-bold text-slate-700 truncate">
                            {getTransferStatusLabel(change.to)}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] text-slate-400">
                              {formatTransferDateTime(change.timestamp)}
                            </span>
                            {onDeleteHistoryEntry && transfer.statusHistory.length > 1 && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  const actualIdx = transfer.statusHistory.length - 1 - idx;
                                  onDeleteHistoryEntry(actualIdx);
                                }}
                                className="p-0.5 text-slate-300 hover:text-red-400 rounded transition-colors opacity-50 hover:opacity-100"
                                title="Eliminar este registro"
                              >
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <User size={10} className="text-slate-400" />
                          <span className="text-[9px] text-slate-500 font-medium">
                            {change.userId.split('@')[0]}
                          </span>
                        </div>
                        {change.notes && (
                          <div className="mt-1 flex gap-1 items-start bg-white p-1.5 rounded border border-slate-100 shadow-sm">
                            <MessageSquare size={10} className="text-slate-400 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-slate-600 leading-tight italic">
                              &quot;{change.notes}&quot;
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
