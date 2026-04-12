/**
 * ClinicalDocumentVersionHistory
 *
 * Popover that shows the version timeline of a clinical document.
 * Each entry displays version number, timestamp, author, and
 * save reason (autosave, manual, signature, etc.).
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Clock, PenLine, FileSignature, ShieldCheck, Wrench } from 'lucide-react';
import type { ClinicalDocumentVersionMeta } from '@/features/clinical-documents/domain/entities';

interface ClinicalDocumentVersionHistoryProps {
  versions: ClinicalDocumentVersionMeta[];
  currentVersion: number;
  onClose: () => void;
}

const formatDateTime = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return iso;
  }
};

const reasonConfig: Record<
  string,
  { label: string; icon: React.FC<{ size: number; className?: string }>; badgeClass: string }
> = {
  autosave: { label: 'Autoguardado', icon: Clock, badgeClass: 'bg-slate-100 text-slate-500' },
  manual: { label: 'Manual', icon: Save, badgeClass: 'bg-blue-50 text-blue-600' },
  signature: {
    label: 'Firmado',
    icon: FileSignature,
    badgeClass: 'bg-emerald-50 text-emerald-600',
  },
  unsign: { label: 'Firma revocada', icon: ShieldCheck, badgeClass: 'bg-amber-50 text-amber-600' },
  admin_fix: { label: 'Admin', icon: Wrench, badgeClass: 'bg-red-50 text-red-600' },
};

const getReasonConfig = (reason: string) =>
  reasonConfig[reason] || {
    label: reason,
    icon: PenLine,
    badgeClass: 'bg-slate-100 text-slate-500',
  };

export const ClinicalDocumentVersionHistory: React.FC<ClinicalDocumentVersionHistoryProps> = ({
  versions,
  currentVersion,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const sorted = [...versions].sort((a, b) => b.version - a.version);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm max-h-[60vh] flex flex-col animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">
            Historial de versiones
            <span className="ml-1.5 text-[10px] font-normal text-slate-400">v{currentVersion}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {sorted.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">Sin historial de versiones</p>
          )}
          <div className="relative border-l-2 border-slate-200 ml-2">
            {sorted.map(v => {
              const config = getReasonConfig(v.reason);
              const Icon = config.icon;
              const isCurrent = v.version === currentVersion;

              return (
                <div key={v.version} className="relative pl-5 pb-4 last:pb-0">
                  {/* Dot */}
                  <div
                    className={`absolute left-[-5px] top-1 w-2 h-2 rounded-full ${
                      isCurrent ? 'bg-medical-500 ring-2 ring-medical-200' : 'bg-slate-300'
                    }`}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono">v{v.version}</span>
                      <span className="text-[10px] text-slate-500 ml-2">
                        {formatDateTime(v.savedAt)}
                      </span>
                      <p className="text-[11px] text-slate-700 mt-0.5">{v.savedBy.displayName}</p>
                    </div>
                    <span
                      className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${config.badgeClass}`}
                    >
                      <Icon size={9} />
                      {config.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
