import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Send, Share2 } from 'lucide-react';
import clsx from 'clsx';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';

interface MedicalShareActionsProps {
  medicalSignature?: {
    doctorName: string;
    signedAt: string;
  } | null;
  onSendWhatsApp: () => void;
  onShareLink: (scope: MedicalHandoffScope) => void;
}

const LINK_OPTIONS: Array<{ scope: MedicalHandoffScope; label: string; className: string }> = [
  { scope: 'all', label: 'Copiar link: todos', className: 'text-slate-700 hover:bg-slate-50' },
  { scope: 'upc', label: 'Copiar link: UPC', className: 'text-red-700 hover:bg-red-50' },
  {
    scope: 'no-upc',
    label: 'Copiar link: No UPC',
    className: 'text-emerald-700 hover:bg-emerald-50',
  },
];

export const MedicalShareActions: React.FC<MedicalShareActionsProps> = ({
  medicalSignature,
  onSendWhatsApp,
  onShareLink,
}) => {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showShareMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareMenu]);

  return (
    <div className="flex items-center gap-2 md:ml-auto">
      <button
        onClick={onSendWhatsApp}
        disabled={!!medicalSignature}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer',
          medicalSignature
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-green-500 text-white hover:bg-green-600'
        )}
        title="Enviar entrega por WhatsApp (Manual)"
        aria-label="Enviar entrega por WhatsApp (Manual)"
      >
        <Send size={14} aria-hidden="true" /> Enviar por WhatsApp
      </button>
      <div className="relative" ref={shareMenuRef}>
        <button
          onClick={() => setShowShareMenu(previous => !previous)}
          className="flex items-center gap-2 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition-colors text-xs font-bold cursor-pointer"
          title="Generar link para firma del médico"
          aria-label="Generar link para firma del médico"
        >
          <Share2 size={14} aria-hidden="true" />
          Links firma
          <ChevronDown
            size={14}
            className={clsx('transition-transform', showShareMenu && 'rotate-180')}
          />
        </button>

        {showShareMenu && (
          <div className="absolute right-0 top-full mt-1 min-w-[220px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-50">
            {LINK_OPTIONS.map(option => (
              <button
                key={option.scope}
                onClick={() => {
                  onShareLink(option.scope);
                  setShowShareMenu(false);
                }}
                className={clsx('w-full px-4 py-2 text-left text-sm', option.className)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
